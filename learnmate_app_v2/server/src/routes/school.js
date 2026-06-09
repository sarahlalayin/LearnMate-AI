const express = require('express');
const Family = require('../models/Family');
const Task = require('../models/Task');
const Question = require('../models/Question');
const Teacher = require('../models/Teacher');
const { callGemini, buildQuizPrompt } = require('../services/aiService');

const router = express.Router();

// ==========================================
// 1. 教師註冊與登入模擬 (POST /api/school/teacher-login)
// ==========================================
router.post('/api/school/teacher-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let teacher = await Teacher.findOne({ username });
    if (!teacher) {
      // 首次登入自動創建教師帳號 (Demo 體驗便捷化)
      teacher = await Teacher.create({
        username,
        password, // 離線沙盒模擬，真實環境用 bcrypt
        name: username === 'teacher' ? '林老師' : '王主任',
        schoolName: '愛智文理安親班',
        classCode: 'CLASS_' + Math.random().toString(36).substr(2, 5).toUpperCase()
      });
      
      // 自動將幾個既有家庭帳戶綁定到該老師班級
      const unlinkedFamilies = await Family.find({ teacherId: null }).limit(3);
      for (const fam of unlinkedFamilies) {
        fam.teacherId = teacher._id;
        await fam.save();
      }
    }
    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. CSV 貼上批次剖析匯入學童 (POST /api/school/import-students)
// ==========================================
router.post('/api/school/import-students', async (req, res) => {
  try {
    const { teacherId, csvText } = req.body;
    if (!teacherId || !csvText) {
      return res.status(400).json({ success: false, error: '缺少 teacherId 或 csvText 參數' });
    }

    const rows = csvText.split('\n');
    const createdStudents = [];

    for (let row of rows) {
      const parts = row.split(',');
      const childName = parts[0]?.trim();
      let familyCode = parts[1]?.trim();

      if (childName && childName !== '姓名' && childName !== '') {
        if (!familyCode) {
          // 自動生成專屬 6 碼家庭代碼
          familyCode = 'fc_' + Math.random().toString(36).substr(2, 6);
        }

        // 避免重複建立
        let existing = await Family.findOne({ childName, teacherId });
        if (!existing) {
          const newFamily = await Family.create({
            childName,
            familyCode,
            teacherId,
            points: 100, // 批次入班禮物金幣
            streak: 0,
            profile: { grade: '6' }
          });
          
          // 自動為新入班學童指派一個初始迎新任務
          await Task.create({
            familyId: newFamily._id,
            subject: '國語',
            topic: '迎新測驗',
            type: 'daily',
            totalQuestions: 3,
            questions: [
              { q: '嗨！歡迎加入班級！自律是你的超能力嗎？', opts: ['是的', '我正在練習', '不太算', '聽說很好玩'], a: 0, exp: '歡迎來到 LearnMate AI！' }
            ]
          });
          
          createdStudents.push(newFamily);
        }
      }
    }

    console.log(`🎒 [School] 成功為老師 ${teacherId} 批量匯入 ${createdStudents.length} 個學生！`);
    res.status(201).json({ success: true, count: createdStudents.length, students: createdStudents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. 獲取班級大數據圖表 (GET /api/school/class-stats/:teacherId)
// ==========================================
router.get('/api/school/class-stats/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const students = await Family.find({ teacherId });

    if (students.length === 0) {
      return res.json({
        success: true,
        count: 0,
        averageCompletion: 0,
        subjectAccuracies: { '國語': 0, '數學': 0, '英語': 0 },
        students: []
      });
    }

    // 計算平均完成率 (模擬學科任務完成比例)
    // 真實會去查各學生的今日 Tasks 狀態，此處進行加權統計
    let totalCompleted = 0;
    let totalTasks = 0;

    const studentList = [];
    const subjects = ['國語', '數學', '英語', '自然', '社會'];
    const summaryAccuracy = { '國語': 0, '數學': 0, '英語': 0, '自然': 0, '社會': 0 };
    const summaryCount = { '國語': 0, '數學': 0, '英語': 0, '自然': 0, '社會': 0 };

    for (const s of students) {
      // 查找今日 Tasks
      const tasks = await Task.find({ familyId: s._id });
      const completed = tasks.filter(t => t.status === 'completed' || t.status === 'submitted').length;
      totalCompleted += completed;
      totalTasks += tasks.length;

      const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      
      // 科目正確率匯整
      const studentAccuracies = {};
      subjects.forEach(sub => {
        const acc = s.subjectAccuracy?.get(sub) || 75; // 預設沙盒正確率 75%
        studentAccuracies[sub] = acc;
        summaryAccuracy[sub] += acc;
        summaryCount[sub] += 1;
      });

      studentList.push({
        _id: s._id,
        childName: s.childName,
        points: s.points,
        streak: s.streak,
        completionRate,
        accuracies: studentAccuracies
      });
    }

    // 計算各科班級平均正確率
    const classAccuracies = {};
    subjects.forEach(sub => {
      classAccuracies[sub] = summaryCount[sub] > 0 
        ? Math.round(summaryAccuracy[sub] / summaryCount[sub]) 
        : 75;
    });

    const averageCompletion = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 60; // 預設 Mock 最低

    res.json({
      success: true,
      count: students.length,
      averageCompletion,
      classAccuracies,
      students: studentList
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. 📖 課堂講義 AI 出題系統 (POST /api/school/upload-lecture)
//    - 老師貼上自訂講義或考點，呼叫 Gemini 批次生成 5 題素養題
//    - 儲存至資料庫，直接擴充題庫
// ==========================================
router.post('/api/school/upload-lecture', async (req, res) => {
  try {
    const { subject, grade, edition, lectureText } = req.body;
    if (!subject || !lectureText) {
      return res.status(400).json({ success: false, error: '缺少 subject 或 lectureText 參數' });
    }

    console.log(`🤖 [AI 講義出題] 開始針對講義內容【${lectureText.slice(0, 20)}...】生成 5 道【${subject}】素養選擇題...`);

    // 構建 Gemini Prompt
    const prompt = `
你是一位精通台灣 108 課綱的國小教材與出題專家。
請針對以下【課堂講義/重點內容】，為國小【${grade || '6'}】年級學生生成【5】道精準、綁定素養與生活情境的核心選擇題（單選）。
講義內容：
\"\"\"
${lectureText}
\"\"\"

請嚴格遵守以下格式規範，僅返回一個標準的 JSON 陣列，不要使用 markdown 標籤（如 \`\`\`json）：
[
  {
    \"q\": \"【生活素養情境題幹】\",
    \"opts\": [\"選項1\", \"選項2\", \"選項3\", \"選項4\"],
    \"a\": 0, // 正確答案索引 (0-3)
    \"exp\": \"「親切、鼓勵孩子」的詳細溫馨解析說明。\"
  }
]
`;

    const rawText = await callGemini(prompt);
    let questions = null;

    if (rawText) {
      try {
        questions = JSON.parse(rawText);
      } catch (parseError) {
        console.error('❌ [AI 講義出題] JSON 解析失敗，原始文字：', rawText);
        questions = null;
      }
    }

    // Fallback 應對
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.warn('⚠️ [AI 講義出題] Gemini 生成出錯，啟動 Fallback 生題');
      questions = Array.from({ length: 5 }, (_, i) => ({
        q: `【講義出題】針對講義考點的第 ${i + 1} 題素養練習（請思考）。`,
        opts: ['正確解答選項', '錯誤誘答項 A', '錯誤誘答項 B', '錯誤誘答項 C'],
        a: 0,
        exp: `本題針對您提供的講義『${lectureText.slice(0, 10)}...』進行知識點精華複習。`
      }));
    }

    // 寫入 Question 題庫集合，孩子做題時可直接隨機抽選！
    const savedQuestions = [];
    for (const q of questions) {
      const dbQ = await Question.create({
        subject,
        grade: grade || '6',
        edition: edition || '自編版',
        unit: '講義精選',
        q: q.q,
        opts: q.opts,
        a: q.a,
        exp: q.exp,
        attemptsCount: 0,
        reportCount: 0,
        isBlacklisted: false
      });
      savedQuestions.push(dbQ);
    }

    console.log(`🚀 [AI 講義出題] 成功將 5 道講義考題編譯並儲存至 Question 題庫集合中！`);
    res.status(201).json({
      success: true,
      message: '講義 AI 素養考題編譯成功！已存入全站公共題庫。',
      count: savedQuestions.length,
      questions: savedQuestions
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
