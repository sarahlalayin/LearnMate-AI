const express = require('express');
const { z } = require('zod');
const ErrorLog = require('../models/ErrorLog');
const Task = require('../models/Task');
const Family = require('../models/Family');
const auth = require('../middleware/authMiddleware');
const checkSub = require('../middleware/authSubscription');
const { callGemini, buildSimilarQuestionPrompt } = require('../services/aiService');

const router = express.Router();

// ==========================================
// Zod 輸入引參校驗
// ==========================================
const addErrorSchema = z.object({
  familyId: z.string().min(1, '缺少 familyId'),
  subject: z.string().min(1, '缺少 subject'),
  grade: z.string().optional().default('6'),
  topic: z.string().optional().default('通用'),
  q: z.string().min(1, '缺少題目題幹 (q)'),
  opts: z.array(z.string()).length(4, '必須為4個選項'),
  a: z.number().int().min(0).max(3, '答案索引必須為0-3'),
  userAnswer: z.number().int().min(0).max(3, '學員錯誤答案索引必須為0-3'),
  exp: z.string().optional().default('無解析')
});

const generateSimilarSchema = z.object({
  errorLogId: z.string().min(1, '缺少 errorLogId')
});

// ==========================================
// 1. 學生端提交錯題 (POST /api/error-log/add)
//    - 學生答錯題目時呼叫，自動防重複，死穴題累加錯誤次數
// ==========================================
router.post('/api/error-log/add', auth, checkSub, async (req, res) => {
  try {
    // 1. 參數驗證
    const validatedData = addErrorSchema.parse(req.body);
    const { familyId, subject, grade, topic, q, opts, a, userAnswer, exp } = validatedData;

    // 2. 防重複檢查 (同一家庭、同一科目、同一題目題幹)
    let errorItem = await ErrorLog.findOne({ familyId, subject, q });

    if (errorItem) {
      // 重複答錯，累加錯誤次數 (死穴題大數據收集)
      errorItem.incorrectCount += 1;
      errorItem.userAnswer = userAnswer;
      errorItem.lastAttemptedAt = Date.now();
      await errorItem.save();
      console.log(`🎯 [ErrorLog] 孩子又卡關了！死穴題錯誤次數累加：${errorItem.incorrectCount} 次`);
    } else {
      // 首次答錯，建立新錯題紀錄
      errorItem = await ErrorLog.create({
        familyId,
        subject,
        grade,
        topic,
        q,
        opts,
        a,
        userAnswer,
        exp,
        incorrectCount: 1,
        lastAttemptedAt: Date.now()
      });
      console.log(`🎯 [ErrorLog] 新增錯題成功：${subject} - ${q.slice(0, 15)}...`);
    }

    res.status(201).json({ success: true, errorLog: errorItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '引參校驗失敗', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. 獲取錯題本列表 (GET /api/error-log/:familyId)
//    - 按科目分類，且依錯誤次數遞減排序（死穴題最前優先複習）
// ==========================================
router.get('/api/error-log/:familyId', auth, checkSub, async (req, res) => {
  try {
    const { familyId } = req.params;
    const { subject } = req.query; // 可選過濾科目

    const query = { familyId };
    if (subject) {
      query.subject = subject;
    }

    // 依 incorrectCount 遞減、更新時間遞減排序
    const logs = await ErrorLog.find(query).sort({ incorrectCount: -1, updatedAt: -1 });

    res.json({ success: true, count: logs.length, errorLogs: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. AI 錯題相似題加強派題 (POST /api/error-log/generate-similar)
//    - 家長針對錯題點擊「針對此題生成相似題」
//    - 呼叫 Gemini 生成 3 道相同核心考點的全新素養選擇題
//    - 自動派發為加強任務 Task
// ==========================================
router.post('/api/error-log/generate-similar', auth, checkSub, async (req, res) => {
  try {
    // 1. Zod 校驗
    const validatedData = generateSimilarSchema.parse(req.body);
    const { errorLogId } = validatedData;

    // 2. 查詢原錯題
    const errorLog = await ErrorLog.findById(errorLogId);
    if (!errorLog) {
      return res.status(404).json({ success: false, error: '找不到該錯題紀錄' });
    }

    // 3. 取得家庭資料 (用於獲取版本等 Onboarding Context)
    const family = await Family.findById(errorLog.familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到家庭資料' });
    }

    console.log(`🤖 [AI 相似題] 開始為錯題【${errorLog.q.slice(0, 15)}...】生成相似素養題...`);

    // 4. 呼叫 Gemini 2.0 Flash 進行相似生題
    const prompt = buildSimilarQuestionPrompt(errorLog.subject, errorLog.grade, errorLog);
    const rawText = await callGemini(prompt);

    let questions = null;
    if (rawText) {
      try {
        questions = JSON.parse(rawText);
      } catch (parseError) {
        console.error('❌ [AI 相似題] JSON 解析失敗，原始文字：', rawText);
        questions = null;
      }
    }

    // 5. Fallback 處理
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.warn('⚠️ [AI 相似題] Gemini 生成出錯，啟動 Fallback 生題機制');
      questions = [
        {
          q: `【加強題】針對原題「${errorLog.q.slice(0, 15)}...」的相似概念練習，請仔細思考。`,
          opts: [...errorLog.opts],
          a: errorLog.a,
          exp: `原題考點解析：${errorLog.exp}`
        }
      ];
    }

    // 6. 寫入 Task Schema 中，作為 "extra" 加強複習測驗任務派發
    const newTask = await Task.create({
      familyId: errorLog.familyId,
      type: 'extra',
      item_type: 'academic',
      subject: errorLog.subject,
      topic: `${errorLog.topic || '課堂'} 相似題錯題加強`,
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        q: q.q,
        opts: q.opts,
        a: q.a,
        exp: q.exp
      })),
      status: 'pending',
      points: 15, // 加強題為 15 點 (給予高成就激勵)
      aiGenerated: true,
      promptParams: {
        grade: errorLog.grade,
        originalQuestionId: errorLog._id
      }
    });

    console.log(`🚀 [AI 相似題] 相似加強測驗任務派發成功！TaskId: ${newTask._id}，共 ${questions.length} 題`);

    res.status(201).json({
      success: true,
      message: 'AI 相似加強測驗派發成功！',
      task: newTask
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '引參校驗失敗', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
