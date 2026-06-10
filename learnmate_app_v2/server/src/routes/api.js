require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const Family = require('../models/Family');
const Task = require('../models/Task');
const Reward = require('../models/Reward');
const Alert = require('../models/Alert');
const Message = require('../models/Message');
const Syllabus = require('../models/Syllabus');
const ActivityTemplate = require('../models/ActivityTemplate');
const Question = require('../models/Question');
const QuizFeedback = require('../models/QuizFeedback');
const { callGemini, buildQuizPrompt, buildVideoPrompt, buildInsightPrompt, generateQuizWithCritic } = require('../services/aiService');
const { searchYouTubeVideo } = require('../services/youtubeService');
const { getPredictedUnit } = require('../services/curriculumService');


const router = express.Router();
const auth = require('../middleware/authMiddleware');
const checkSub = require('../middleware/authSubscription');

// ==========================================
// 成長護照 6 款核心成就徽章判定解鎖邏輯 (Phase D3)
// ==========================================
async function checkAndUnlockBadges(family, task = null) {
  try {
    const unlockedBadges = family.badges || [];
    const currentIds = unlockedBadges.map(b => b.badgeId);
    let updated = false;

    // 輔助函數：解鎖徽章
    const unlock = (badgeId, name, description) => {
      if (!currentIds.includes(badgeId)) {
        unlockedBadges.push({ badgeId, name, description, unlockedAt: new Date() });
        currentIds.push(badgeId);
        updated = true;
        console.log(`🏆 [Badge Unlocked] 恭喜孩子解鎖徽章：【${name}】！`);
      }
    };

    // 1. 🔥 自律小達人 (b1) - 連續自律連勤滿 7 天
    if (family.streak >= 7) {
      unlock('b1', '自律小達人 🔥', '連續自律打卡/連勤滿 7 天，大腦習慣形成的里程碑！');
    }

    // 2. 🎯 滿分特攻隊 (b2) - 隨堂測驗獲得 100% 正確學業回報
    // (在 /api/tasks/complete 中已直接判定 b2 並加入，此處作為雙重保險)

    // 3. 📚 學海無涯 (b3) - 累計答題次數滿 50 次
    let totalQuizCount = 0;
    if (family.subjectQuizCount) {
      for (const count of family.subjectQuizCount.values()) {
        totalQuizCount += count;
      }
    }
    if (totalQuizCount >= 50) {
      unlock('b3', '學海無涯 📚', '累計隨堂答題次數達到 50 關，大腦知識量滿滿！');
    }

    // 4. ❌ 錯題剋星 (b4) - 完成一次家長指派的 AI 相似題加強任務
    if (task && task.type === 'extra' && task.topic && (task.topic.includes('相似題') || task.topic.includes('加強'))) {
      unlock('b4', '錯題剋星 ❌', '成功攻克並完成家長指派的 AI 錯題相似加強題，消滅弱點！');
    }

    // 5. 🧘 自律大師 (b5) - 習慣打卡（運動、才藝等）累計滿 10 次
    const habitCount = await mongoose.model('Task').countDocuments({
      familyId: family._id,
      item_type: 'habit',
      status: 'completed'
    });
    if (habitCount >= 10) {
      unlock('b5', '自律大師 🧘', '累計完成自律生活/才藝養成習慣打卡 10 次，自控力之王！');
    }

    // 6. 👑 Pro 全能王 (b6) - 解鎖 Pro 且解鎖上述至少 3 個徽章
    const isPro = family.subscription && family.subscription.plan === 'pro' && family.subscription.status === 'active';
    const otherBadgesCount = currentIds.filter(id => id !== 'b6').length;
    if (isPro && otherBadgesCount >= 3) {
      unlock('b6', 'Pro 全能王 👑', '擁有 Pro 高階會員且成功解鎖至少 3 款核心成就徽章，全能戰士！');
    }

    if (updated) {
      family.badges = unlockedBadges;
      family.markModified('badges');
    }
    return updated;
  } catch (err) {
    console.error('❌ [Badge] 徽章判定出錯：', err);
    return false;
  }
}

// ==========================================

// ==========================================
// API 路由
// ==========================================

// 1. 登入與初始化
router.post('/api/auth/login', async (req, res) => {
  try {
    const { familyCode } = req.body;
    let family = await Family.findOne({ familyCode });
    if (!family) {
      family = await Family.create({
        familyCode,
        childName: '小明',
        points: 320,
        streak: 5,
        profile: { grade: '6', editions: { '數學': '康軒版', '國語': '南一版', '英語': '康軒版', '社會': '翰林版', '自然': '翰林版' } },
        subscription: { plan: 'pro', status: 'active' } // 新註冊帳戶預設開通 Pro
      });
      await Task.insertMany([
        { familyId: family._id, subject: '國語', topic: 'L5 詞語複習', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '數學', topic: '第一~六單元總複習', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '英語', topic: '現在進行式', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '自然', topic: '植物的構造', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '社會', topic: '台灣地理', type: 'daily', totalQuestions: 5 }
      ]);
      await Reward.insertMany([
        { familyId: family._id, name: '玩 Switch 30分鐘', cost: 100, proposedBy: 'parent', icon: '🎮' },
        { familyId: family._id, name: '看卡通一集', cost: 50, proposedBy: 'parent', icon: '📺' },
        { familyId: family._id, name: '週末去公園', cost: 300, proposedBy: 'parent', icon: '⚽' }
      ]);
    } else {
      // 確保已存在帳戶的 Pro 權限同樣啟用，以防過期
      if (!family.subscription || family.subscription.plan !== 'pro' || family.subscription.status !== 'active') {
        family.subscription = { plan: 'pro', status: 'active' };
        await family.save();
      }
    }

    // 簽發 JWT Token 以通過 auth 中間件校驗
    const token = jwt.sign(
      { id: family._id, email: family.email, plan: family.subscription?.plan || 'pro' },
      process.env.JWT_SECRET || 'learnmate_secret_jwt_key_2026',
      { expiresIn: '2h' }
    );

    res.json({ success: true, family, accessToken: token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 取得今日任務
router.get('/api/tasks/:familyId', async (req, res) => {
  try {
    const tasks = await Task.find({ familyId: req.params.familyId });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. AI 考題生成 ★ 核心功能（優先從題庫抽題，並結合進度偵測與 Critic Loop 審查）
router.post('/api/tasks/generate', auth, checkSub, async (req, res) => {
  try {
    const { subject, topic, grade, edition, familyId, count = 5 } = req.body;

    const family = await Family.findById(familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭帳戶' });

    // ── 學習進度自動偵測與對齊 ─────────────────────────
    let currentTopic = topic;
    const cleanEdition = edition || family.profile?.editions?.get(subject) || '康軒版';
    const cleanGrade = grade || family.profile?.grade || '5';

    if (!currentTopic) {
      // 學生未輸入主題，系統自動偵測學校進度
      const offset = (family.profile?.progressOffset instanceof Map 
        ? family.profile.progressOffset.get(subject) 
        : family.profile?.progressOffset?.[subject]) || 0;
      
      const prediction = getPredictedUnit(cleanGrade, subject, cleanEdition, offset);
      currentTopic = prediction.unit;
      console.log(`📅 [Progress Alignment] 自動對齊學校進度：${subject} (${cleanEdition}) -> ${currentTopic}`);
    }

    // 檢查是否處於段考複習模式 (Phase D2)
    let finalTopic = currentTopic;
    let examModeActive = false;
    let examRange = '';

    if (family && family.examPrep && family.examPrep.countdownActive && family.examPrep.examDate) {
      const daysLeft = Math.ceil((new Date(family.examPrep.examDate).getTime() - Date.now()) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 14) {
        const subPrep = family.examPrep.subjects.find(s => s.subjectName === subject);
        if (subPrep && subPrep.range) {
          examModeActive = true;
          examRange = subPrep.range;
          finalTopic = `${currentTopic} (段考複習加重範圍：${examRange})`;
          console.log(`🎯 [ExamPrep] 啟動段考複習出題加強！科目【${subject}】加重範圍為：${examRange}`);
        }
      }
    }

    let questions = null;
    let fromDB = false;
    let criticPassed = true;
    let criticAttempts = 0;

    // Step 1: 優先採用多 Agent 協同出題與進度對齊
    console.log(`🤖 [Agent Priority] 啟動多 Agent 協同出題與 Critic Loop 審核。主題: ${finalTopic}`);
    try {
      // 檢索該學科被家長回報的 Bad Cases 作為避雷針
      const badCases = await QuizFeedback.find({ subject, status: { $ne: 'fixed' } })
        .sort({ createdAt: -1 })
        .limit(3);

      const agentResult = await generateQuizWithCritic(
        subject,
        finalTopic,
        cleanGrade,
        cleanEdition,
        count,
        badCases
      );

      questions = agentResult.questions;
      criticAttempts = agentResult.attempts;
      criticPassed = agentResult.passed;
    } catch (aiError) {
      console.error('❌ [Agent Priority] AI 出題過程發生錯誤：', aiError.message);
    }

    // Step 2: AI 生成失敗，降級（Fallback）到題庫 DB 抽題
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.warn(`⚠️ [Fallback] AI 出題未成功，嘗試從本地題庫 DB 抽取題目...`);
      const dbQuestions = await Question.find({ subject, grade: cleanGrade });
      console.log(`📚 [題庫] ${subject} 本地找到 ${dbQuestions.length} 題`);

      if (dbQuestions.length >= count) {
        const shuffled = [...dbQuestions].sort(() => Math.random() - 0.5);
        questions = shuffled.slice(0, count).map(q => ({ q: q.q, opts: q.opts, a: q.a, exp: q.exp }));
        fromDB = true;
        console.log(`✅ [Fallback] 從本地題庫 DB 成功隨機抽取 ${count} 題`);
      }
    }

    // Step 3: 最終萬用 Fallback（若 DB 也無題目）
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.error(`❌ [Critical Fallback] AI 與本地題庫均失效，使用通用備份題目。`);
      questions = Array.from({ length: count }, (_, i) => ({
        q: `【${subject}】第 ${i + 1} 題（核心考題準備中）`,
        opts: ['選項 A', '選項 B', '選項 C', '選項 D'],
        a: 0, 
        exp: '請稍後重試，或聯絡管理員至後台新增題庫。'
      }));
    }

    const newTask = await Task.create({
      familyId, type: 'extra', subject, topic: finalTopic,
      totalQuestions: questions.length,
      questions,
      aiGenerated: !fromDB,
      promptParams: { grade: cleanGrade, edition: cleanEdition }
    });

    res.json({
      success: true,
      task: newTask,
      fromDB,
      aiGenerated: !fromDB,
      criticPassed,
      criticAttempts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 直接派發非學科活動任務 (不呼叫 AI)
router.post('/api/tasks/create-activity', async (req, res) => {
  try {
    const { familyId, subject, topic } = req.body;
    const newTask = await Task.create({
      familyId, type: 'extra', subject, topic,
      totalQuestions: 0, questions: [],
      isActivity: true, aiGenerated: false
    });
    res.json({ success: true, task: newTask });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ★ 學生送審（pending → submitted）
router.post('/api/tasks/submit', async (req, res) => {
  try {
    const { taskId, earnedPoints, correctCount, totalCount, subject } = req.body;
    const task = await Task.findByIdAndUpdate(
      taskId,
      { status: 'submitted', earnedPoints: earnedPoints || 0 },
      { new: true }
    );
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ★ 家長確認完成（submitted → completed，給積分）
router.post('/api/tasks/approve-extra', async (req, res) => {
  try {
    const { familyId, taskId, message } = req.body;
    const task = await Task.findByIdAndUpdate(taskId, { status: 'completed' }, { new: true });
    const family = await Family.findById(familyId);
    const pts = task.earnedPoints || 15;
    family.points += pts;
    // streak 自動更新
    const todayTW = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
    if (family.lastActiveDate !== todayTW) {
      const yesterday = new Date(Date.now() + 8 * 3600000 - 86400000).toISOString().split('T')[0];
      family.streak = (family.lastActiveDate === yesterday) ? (family.streak || 0) + 1 : 1;
      family.lastActiveDate = todayTW;
    }
    // 呼叫通用徽章檢測 (傳入剛完成的加強/習慣 Task)
    await checkAndUnlockBadges(family, task);

    await family.save();
    if (message) await Message.create({ familyId, text: message, from: 'parent' });
    res.json({ success: true, points: family.points });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ★ 家長退回重做（submitted → pending）
router.post('/api/tasks/reject-extra', async (req, res) => {
  try {
    const { familyId, taskId, message } = req.body;
    await Task.findByIdAndUpdate(taskId, { status: 'rejected', earnedPoints: 0 });
    if (message) await Message.create({ familyId, text: message, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. ★ AI 影片推薦（新路由）
router.post('/api/videos/recommend', auth, checkSub, async (req, res) => {
  try {
    const { familyId, grade, weakSubjects, topics } = req.body;

    // 快取機制：30 分鐘內不重複呼叫 YouTube（節省 Quota）
    const family = await Family.findById(familyId);
    const cacheAge = family?.videoRecommendations?.cachedAt
      ? (Date.now() - new Date(family.videoRecommendations.cachedAt).getTime()) / 60000
      : 999;

    if (cacheAge < 30 && family.videoRecommendations.videos.length > 0) {
      return res.json({ success: true, videos: family.videoRecommendations.videos, fromCache: true });
    }

    // Step 1：Gemini 生成搜尋關鍵字（不消耗 YouTube Quota）
    const editions = family?.profile?.editions || {};
    // 將 Map 或 Object 轉為標準 Object，方便取值
    let editionsObj = {};
    try {
      if (editions instanceof Map) {
        editionsObj = Object.fromEntries(editions);
      } else {
        editionsObj = editions;
      }
    } catch(e) {}

    const prompt = buildVideoPrompt(grade || '5', editions, weakSubjects || '英語', topics || '現在進行式');
    const rawText = await callGemini(prompt);
    let suggestions = null;
    if (rawText) {
      try { suggestions = JSON.parse(rawText); } catch (e) { suggestions = null; }
    }

    // Fallback 關鍵字（Gemini 失敗、限流或沒回傳有效 JSON 時使用）
    // 這裡同樣綁定真實的「年級」與「版本」，不再使用寫死的假資料
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      suggestions = [
        { keyword: `小學 ${grade}年級 英語 ${editionsObj['英語']||''} 教學`, subject: '英語', desc: `適合 ${grade}年級 的英語教學` },
        { keyword: `小學 ${grade}年級 數學 ${editionsObj['數學']||''} 教學`, subject: '數學', desc: `適合 ${grade}年級 的數學解說` },
        { keyword: `小學 ${grade}年級 自然 ${editionsObj['自然']||''} 教學`, subject: '自然', desc: `適合 ${grade}年級 的自然教學` }
      ];
    }

    // Step 2：每個關鍵字搜尋 1 支 YouTube 影片（每支 ~101 Quota Units）
    // 最多搜尋 3 支，最差情況消耗 303 units（每日 10,000 units 額度綽綽有餘）
    const videos = [];
    for (const s of suggestions.slice(0, 3)) {
      const ytData = await searchYouTubeVideo(s.keyword);
      videos.push({
        videoId: ytData?.videoId || null,
        title: ytData?.title || `${s.subject}學習影片`,
        channel: ytData?.channel || '',
        thumbnail: ytData?.thumbnail || '',
        duration: ytData?.duration || '',
        subject: s.subject,
        desc: s.desc,
        keyword: s.keyword
      });
    }

    // 存入 MongoDB 快取（下次 30 分鐘內直接回傳，不再呼叫 YouTube）
    if (family) {
      family.videoRecommendations = { cachedAt: new Date(), videos };
      await family.save();
    }

    res.json({ success: true, videos, aiGenerated: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// 5. ★ AI 週報分析（新路由）
router.post('/api/insights/report', async (req, res) => {
  try {
    const { familyId, childName, grade, completionRate, accuracyData, skipped, hasExtra } = req.body;
    const prompt = buildInsightPrompt(childName, grade, completionRate, accuracyData, skipped, hasExtra);
    const reportText = await callGemini(prompt);

    if (reportText) {
      res.json({ success: true, report: reportText, aiGenerated: true });
    } else {
      res.json({ success: true, report: `${childName}本週學習狀況整體穩定，完成率達 ${completionRate}%。建議持續鼓勵孩子保持學習節奏，若有弱勢科目可透過加強題練習。`, aiGenerated: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. 取得獎勵清單
router.get('/api/rewards/:familyId', async (req, res) => {
  try {
    const rewards = await Reward.find({ familyId: req.params.familyId });
    res.json({ success: true, rewards });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 許願新獎勵 (學生端)
router.post('/api/rewards/propose', async (req, res) => {
  try {
    const { familyId, name, icon } = req.body;
    const newReward = await Reward.create({ familyId, name, icon, cost: 0, proposedBy: 'student', status: 'proposed' });
    res.json({ success: true, reward: newReward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7b. 同意孩子提議的新獎勵（家長設定點數）★ BUG-08 修復
router.post('/api/rewards/approve-proposal', async (req, res) => {
  try {
    const { familyId, rewardId, cost, message } = req.body;
    const reward = await Reward.findByIdAndUpdate(
      rewardId,
      { status: 'ready', cost: parseInt(cost) || 0 },
      { new: true }
    );
    if (!reward) return res.status(404).json({ success: false, error: '找不到獎勵' });
    if (message) await Message.create({ familyId, text: message, from: 'parent' });
    res.json({ success: true, reward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7c. 婉拒孩子提議的獎勵（家長）★ BUG-08 修復
router.post('/api/rewards/reject-proposal', async (req, res) => {
  try {
    const { familyId, rewardId, message } = req.body;
    await Reward.findByIdAndDelete(rewardId);
    if (message) await Message.create({ familyId, text: message, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 申請兌換獎勵 (學生端)
router.post('/api/rewards/claim', async (req, res) => {
  try {
    const { familyId, rewardId } = req.body;
    const reward = await Reward.findById(rewardId);
    const family = await Family.findById(familyId);
    if (family.points >= reward.cost) {
      family.points -= reward.cost;
      await family.save();
      reward.requests.push({ status: 'pending' });
      await reward.save();
      res.json({ success: true, points: family.points });
    } else {
      res.status(400).json({ success: false, error: '點數不足' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. 審核獎勵 (家長端)
router.post('/api/rewards/approve', async (req, res) => {
  try {
    const { familyId, rewardId, requestId, action, message } = req.body;
    const reward = await Reward.findById(rewardId);
    const reqItem = reward.requests.id(requestId);
    if (action === 'approve') {
      reqItem.status = 'approved';
    } else {
      reward.requests.pull(requestId);
      const family = await Family.findById(familyId);
      family.points += reward.cost;
      await family.save();
    }
    await reward.save();
    if (message) await Message.create({ familyId, text: message, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. 標記已使用獎勵
router.post('/api/rewards/use', async (req, res) => {
  try {
    const { rewardId, requestId } = req.body;
    const reward = await Reward.findById(rewardId);
    if (reward) { reward.requests.pull(requestId); await reward.save(); }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. 儲存設定
router.post('/api/profile/update', async (req, res) => {
  try {
    const { familyId, grade, editions } = req.body;
    // 清除影片快取（設定改變時重新推薦）
    await Family.findByIdAndUpdate(familyId, {
      profile: { grade, editions },
      'videoRecommendations.cachedAt': null,
      'videoRecommendations.videos': []
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 學習進度偵測與微調 API (Syllabus & Progress)
// ==========================================

// A. 獲取預計週進度與單元
router.get('/api/progress/predict', auth, async (req, res) => {
  try {
    const { familyId } = req.query;
    if (!familyId) return res.status(400).json({ success: false, error: '缺少 familyId' });

    const family = await Family.findById(familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭資料' });

    const grade = family.profile?.grade || '5';
    const editions = family.profile?.editions || new Map();
    const progressOffset = family.profile?.progressOffset || new Map();

    const result = [];
    const keys = editions instanceof Map ? Array.from(editions.keys()) : Object.keys(editions);
    
    for (const subject of keys) {
      const edition = editions instanceof Map ? editions.get(subject) : editions[subject];
      const offset = (progressOffset instanceof Map ? progressOffset.get(subject) : progressOffset[subject]) || 0;
      
      const prediction = getPredictedUnit(grade, subject, edition, offset);
      result.push({
        subject,
        edition,
        offset,
        currentWeek: prediction.week,
        targetWeek: prediction.targetWeek,
        unit: prediction.unit,
        isFallback: prediction.isFallback
      });
    }

    res.json({ success: true, progressList: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// B. 微調進度偏差值
router.post('/api/progress/adjust', auth, async (req, res) => {
  try {
    const { familyId, subject, offset } = req.body;
    if (!familyId || !subject || typeof offset !== 'number') {
      return res.status(400).json({ success: false, error: '參數缺失' });
    }

    const family = await Family.findById(familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭資料' });

    if (!family.profile.progressOffset) {
      family.profile.progressOffset = new Map();
    }
    
    family.profile.progressOffset.set(subject, offset);
    family.markModified('profile.progressOffset');
    await family.save();

    const grade = family.profile.grade || '5';
    const edition = family.profile.editions instanceof Map 
      ? family.profile.editions.get(subject) 
      : family.profile.editions[subject] || '康軒版';
      
    const prediction = getPredictedUnit(grade, subject, edition, offset);

    res.json({
      success: true,
      subject,
      offset,
      currentWeek: prediction.week,
      targetWeek: prediction.targetWeek,
      unit: prediction.unit
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// C. 家長/教師題目錯誤與超綱回報 API (Feedback Loop)
router.post('/api/quiz/feedback', auth, async (req, res) => {
  try {
    const { familyId, subject, q, opts, a, userAnswer, feedback_type, parent_note } = req.body;
    if (!familyId || !subject || !q || !feedback_type) {
      return res.status(400).json({ success: false, error: '缺少必要參數' });
    }

    const feedback = await QuizFeedback.create({
      familyId,
      subject,
      q,
      opts: opts || [],
      a: typeof a === 'number' ? a : null,
      userAnswer: typeof userAnswer === 'number' ? userAnswer : null,
      feedback_type,
      parent_note: parent_note || '',
      status: 'pending'
    });

    console.log(`⚑ [QuizFeedback] 收到新題目回報：[${feedback_type}] 科目=${subject}`);
    res.status(201).json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// 12. 傳送留言
router.post('/api/messages/send', async (req, res) => {
  try {
    const { familyId, text } = req.body;
    await Message.create({ familyId, text, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. 完成測驗（★ 新增 streak 和正確率更新）
router.post('/api/tasks/complete', async (req, res) => {
  try {
    const { familyId, taskId, pointsToAdd, correctCount, totalCount, subject } = req.body;
    if (taskId) await Task.findByIdAndUpdate(taskId, { status: 'completed' });
    const family = await Family.findById(familyId);

    // 加點數
    family.points += (pointsToAdd || 0);

    // ★ streak 自動更新（以台灣時區 UTC+8）
    const todayTW = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
    if (family.lastActiveDate !== todayTW) {
      const yesterday = new Date(Date.now() + 8 * 3600000 - 86400000).toISOString().split('T')[0];
      family.streak = (family.lastActiveDate === yesterday) ? (family.streak || 0) + 1 : 1;
      family.lastActiveDate = todayTW;
    }

    // ★ 各科正確率更新（加權移動平均）
    if (subject && typeof correctCount === 'number' && typeof totalCount === 'number' && totalCount > 0) {
      const newPct = Math.round((correctCount / totalCount) * 100);
      const oldPct = family.subjectAccuracy?.get(subject) ?? null;
      const cnt = family.subjectQuizCount?.get(subject) || 0;
      family.subjectAccuracy.set(subject, oldPct === null ? newPct : Math.round((cnt * oldPct + newPct) / (cnt + 1)));
      family.subjectQuizCount.set(subject, cnt + 1);
    }

    // 檢查解鎖滿分特攻隊 (b2)
    if (correctCount === totalCount && totalCount >= 5) {
      const unlockedBadges = family.badges || [];
      const currentIds = unlockedBadges.map(b => b.badgeId);
      if (!currentIds.includes('b2')) {
        family.badges.push({
          badgeId: 'b2',
          name: '滿分特攻隊 🎯',
          description: '隨堂測驗獲得 100% 正確答對，實力無懈可擊！',
          unlockedAt: new Date()
        });
      }
    }
    // 呼叫通用徽章檢測
    await checkAndUnlockBadges(family, { item_type: 'academic', totalQuestions: totalCount });

    await family.save();
    res.json({ success: true, points: family.points, streak: family.streak });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// 14. 跳過任務
router.post('/api/tasks/skip', async (req, res) => {
  try {
    const { familyId, taskId, reason } = req.body;
    const task = await Task.findByIdAndUpdate(taskId, { status: 'skipped' }, { new: true });
    const family = await Family.findById(familyId);
    family.points = Math.max(0, family.points - 5);
    await family.save();

    let alertType = 'warning', alertTitle = `${task.subject} — 暫停`, alertDesc = `孩子因為「${reason}」暫停了這科。`;
    if (reason === '看不懂') {
      alertType = 'critical';
      alertTitle = `${task.subject} — 需要神隊友救援 🚨`;
      alertDesc = '孩子誠實表示這科看不懂！建議今晚先給他一個擁抱，再一起看看哪裡卡住了。';
    } else if (reason === '功課太多') {
      alertTitle = `${task.subject} — 功課太多暫停`;
      alertDesc = `孩子覺得學校功課太多，選擇讓大腦休息。請給予時間管理的肯定！`;
    }
    await Alert.create({ familyId, type: alertType, title: alertTitle, desc: alertDesc });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清除所有加強任務 (Demo專用)
router.post('/api/tasks/clear-extra', async (req, res) => {
  try {
    const { familyId } = req.body;
    await Task.deleteMany({ familyId, type: 'extra' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 刪除指定任務
router.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.taskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ★ 家長自訂非學科習慣 API
router.get('/api/family/:familyId/activities', async (req, res) => {
  try {
    const family = await Family.findById(req.params.familyId).select('customActivities');
    res.json({ success: true, activities: family?.customActivities || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/family/:familyId/activities', async (req, res) => {
  try {
    const { name, category, icon, points } = req.body;
    const family = await Family.findById(req.params.familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭' });
    family.customActivities.push({ name, category: category || '其他', icon: icon || '⭐', points: points || 10 });
    await family.save();
    res.json({ success: true, activities: family.customActivities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api/family/:familyId/activities/:activityId', async (req, res) => {
  try {
    const family = await Family.findById(req.params.familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭' });
    family.customActivities.pull({ _id: req.params.activityId });
    await family.save();
    res.json({ success: true, activities: family.customActivities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ★ 後台管理系統 API (Admin)
// ==========================================

// 取得所有課綱
router.get('/api/admin/syllabus', async (req, res) => {
  try {
    const data = await Syllabus.find().sort({ academicYear: -1, grade: 1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 新增或更新課綱
router.post('/api/admin/syllabus', async (req, res) => {
  try {
    const { academicYear, grade, subject, edition, content } = req.body;
    // 假設同一年級、科目、版本只有一筆
    const syllabus = await Syllabus.findOneAndUpdate(
      { academicYear, grade, subject, edition },
      { content },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: syllabus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 刪除課綱
router.delete('/api/admin/syllabus/:id', async (req, res) => {
  try {
    await Syllabus.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 取得所有非學科活動範本
router.get('/api/admin/activities', async (req, res) => {
  try {
    const data = await ActivityTemplate.find().sort({ category: 1 });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 新增非學科活動範本
router.post('/api/admin/activities', async (req, res) => {
  try {
    const { category, title, defaultPoints } = req.body;
    const activity = await ActivityTemplate.create({ category, title, defaultPoints });
    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 刪除非學科活動範本
router.delete('/api/admin/activities/:id', async (req, res) => {
  try {
    await ActivityTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 15. 同步完整狀態
router.get('/api/sync/:familyId', async (req, res) => {
  try {
    const familyId = req.params.familyId;
    const family = await Family.findById(familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭' });

    const tasks = await Task.find({ familyId });
    const rewards = await Reward.find({ familyId });
    const alerts = await Alert.find({ familyId }).sort({ createdAt: -1 });
    const messages = await Message.find({ familyId }).sort({ createdAt: 1 });

    res.json({
      success: true,
      db: {
        familyId: family._id,
        childName: family.childName,
        profile: family.profile,
        points: family.points,
        streak: family.streak,
        subjectAccuracy: Object.fromEntries(family.subjectAccuracy || new Map()),
        tasks: tasks.filter(t => t.type === 'daily'),
        extraTasks: tasks.filter(t => t.type === 'extra' && t.status !== 'completed'),
        submittedCount: tasks.filter(t => t.type === 'extra' && t.status === 'submitted').length,
        rewards,
        rewardRequests: rewards.flatMap(r =>
          r.requests.map(req => ({ ...req.toObject(), rewardId: r._id, _id: req._id.toString() }))
        ),
        alerts,
        messages: messages.map(m => m.text),
        activities: family.customActivities || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 重置測試資料 API
// ==========================================
router.post('/api/demo/reset', async (req, res) => {
  try {
    const { familyId } = req.body;
    if (!familyId) return res.status(400).json({ success: false, error: 'Missing familyId' });
    
    await Family.findByIdAndDelete(familyId);
    await Task.deleteMany({ familyId });
    await Reward.deleteMany({ familyId });
    await Alert.deleteMany({ familyId });
    await Message.deleteMany({ familyId });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 模擬付費解鎖 Pro API (Phase C)
// ==========================================
router.post('/api/billing/mock-unlock', async (req, res) => {
  try {
    const { familyId } = req.body;
    if (!familyId) {
      return res.status(400).json({ success: false, error: '缺少 familyId 參數' });
    }

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶' });
    }

    // 將訂閱狀態設為 active / pro
    family.subscription = {
      plan: 'pro',
      status: 'active',
      trial_ends_at: new Date(Date.now() + 30 * 86400000), // 30天後
      current_period_end: new Date(Date.now() + 30 * 86400000),
      revenuecat_id: 'mock_rc_' + familyId,
      platform: 'web'
    };

    await family.save();
    console.log(`💎 [Billing] 家庭 ${familyId} 模擬解鎖 Pro 成功！`);
    res.json({ success: true, subscription: family.subscription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 段考複習模式設定 API (Phase D2)
// ==========================================
router.post('/api/exam-prep/settings', auth, async (req, res) => {
  try {
    const { familyId, examDate, countdownActive, subjects } = req.body;
    if (!familyId) {
      return res.status(400).json({ success: false, error: '缺少 familyId 參數' });
    }

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶' });
    }

    family.examPrep = {
      examDate: examDate ? new Date(examDate) : null,
      countdownActive: countdownActive ?? false,
      subjects: subjects || []
    };

    await family.save();
    console.log(`🎯 [ExamPrep] 家庭 ${familyId} 更新段考複習設定成功！`);
    res.json({ success: true, examPrep: family.examPrep });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/exam-prep/:familyId', auth, async (req, res) => {
  try {
    const { familyId } = req.params;
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶' });
    }

    res.json({ success: true, examPrep: family.examPrep || { examDate: null, countdownActive: false, subjects: [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 成長護照 PDF 報告匯出 API (Phase D3)
// ==========================================
router.get('/api/insights/passport-pdf/:familyId', async (req, res) => {
  try {
    const { familyId } = req.params;
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).send('<h1>找不到該家庭帳戶</h1>');
    }

    // 計算各科總答題量
    let totalQuizCount = 0;
    if (family.subjectQuizCount) {
      for (const count of family.subjectQuizCount.values()) {
        totalQuizCount += count;
      }
    }

    // 取得已解鎖的徽章
    const unlockedBadges = family.badges || [];
    const unlockedIds = unlockedBadges.map(b => b.badgeId);

    // 定義 6 款徽章在報告中的視覺定義
    const ALL_BADGES = [
      { id: 'b1', name: '自律小達人 🔥', emoji: '🔥', desc: '連續自律打卡/連勤滿 7 天，大腦習慣形成的里程碑！' },
      { id: 'b2', name: '滿分特攻隊 🎯', emoji: '🎯', desc: '隨堂測驗獲得 100% 正確答對，實力無懈可擊！' },
      { id: 'b3', name: '學海無涯 📚', emoji: '📚', desc: '累計隨堂答題次數達到 50 關，大腦知識量滿滿！' },
      { id: 'b4', name: '錯題剋星 ❌', emoji: '❌', desc: '成功攻克並完成家長指派的 AI 錯題相似加強題，消滅弱點！' },
      { id: 'b5', name: '自律大師 🧘', emoji: '🧘', desc: '累計完成自律生活/才藝養成習慣打卡 10 次，自控力之王！' },
      { id: 'b6', name: 'Pro 全能王 👑', emoji: '👑', desc: '擁有 Pro 高階會員且成功解鎖至少 3 款核心成就徽章，全能戰士！' }
    ];

    // 動態渲染 HTML 與精緻 CSS
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>LearnMate AI — ${family.childName} 的成長護照</title>
  <style>
    :root {
      --primary: #8B5CF6;
      --primary-glow: rgba(139, 92, 246, 0.15);
      --success: #10B981;
      --warning: #F59E0B;
      --critical: #EF4444;
      --background: #0F172A;
      --card-bg: #1E293B;
      --text: #F8FAFC;
      --text-sec: #94A3B8;
      --border: #334155;
    }
    body {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--background);
      color: var(--text);
      margin: 0;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .passport-container {
      max-width: 850px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 24px;
      border: 1px solid var(--border);
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }
    /* 裝飾背景發光 */
    .passport-container::before {
      content: '';
      position: absolute;
      top: -150px;
      right: -150px;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
      pointer-events: none;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--border);
      padding-bottom: 30px;
      margin-bottom: 30px;
    }
    .profile-section {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--primary);
      color: #fff;
      font-size: 32px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px var(--primary-glow);
    }
    .profile-info h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
    }
    .profile-info p {
      margin: 5px 0 0 0;
      color: var(--text-sec);
      font-size: 14px;
    }
    .badge-premium {
      background: #F59E0B22;
      border: 1px solid var(--warning);
      color: var(--warning);
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: bold;
    }
    .print-btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }
    .print-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 35px;
    }
    .stat-card {
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
    }
    .stat-card h3 {
      margin: 0 0 8px 0;
      color: var(--text-sec);
      font-size: 14px;
    }
    .stat-card p {
      margin: 0;
      font-size: 32px;
      font-weight: 800;
      color: var(--primary);
    }
    .stat-card p.streak-val {
      color: var(--warning);
    }
    .stat-card p.points-val {
      color: var(--success);
    }
    .section-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-left: 4px solid var(--primary);
      padding-left: 12px;
    }
    .badges-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 35px;
    }
    .badge-card {
      background: rgba(15, 23, 42, 0.3);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
      display: flex;
      gap: 15px;
      align-items: center;
      transition: all 0.3s;
    }
    .badge-card.unlocked {
      border-color: var(--primary-glow);
      background: rgba(139, 92, 246, 0.05);
      box-shadow: 0 4px 15px rgba(139, 92, 246, 0.05);
    }
    .badge-card.locked {
      opacity: 0.5;
    }
    .badge-icon {
      font-size: 40px;
      background: rgba(15, 23, 42, 0.5);
      width: 70px;
      height: 70px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
    }
    .badge-card.unlocked .badge-icon {
      border-color: var(--primary);
      background: rgba(139, 92, 246, 0.15);
      animation: pulse 2s infinite;
    }
    .badge-details h4 {
      margin: 0 0 5px 0;
      font-size: 16px;
      font-weight: 700;
    }
    .badge-card.unlocked .badge-details h4 {
      color: var(--text);
    }
    .badge-details p {
      margin: 0;
      font-size: 12px;
      color: var(--text-sec);
      line-height: 1.4;
    }
    .badge-time {
      font-size: 10px;
      color: var(--success);
      margin-top: 5px;
      display: block;
      font-weight: bold;
    }
    .ai-evaluation {
      background: var(--primary-glow);
      border: 1px dashed var(--primary);
      border-radius: 20px;
      padding: 25px;
      margin-top: 35px;
    }
    .ai-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      font-weight: bold;
      color: var(--primary);
    }
    .ai-content {
      font-size: 14px;
      color: var(--text);
      line-height: 1.7;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
    }
    @media print {
      body {
        background-color: #fff;
        color: #000;
        padding: 0;
      }
      .passport-container {
        border: none;
        box-shadow: none;
        background: #fff;
        padding: 0;
      }
      .print-btn {
        display: none;
      }
      .stat-card {
        border-color: #ddd;
        background: #f9f9f9;
      }
      .badge-card {
        border-color: #ddd;
        background: #fcfcfc;
      }
      .ai-evaluation {
        border-color: #ccc;
        background: #f5f5f5;
        color: #000;
      }
    }
  </style>
</head>
<body>

  <div class="passport-container">
    
    <div class="header">
      <div class="profile-section">
        <div class="avatar">${family.childName[0]}</div>
        <div class="profile-info">
          <h1>${family.childName} 的成長護照</h1>
          <p>
            年級：國小 ${family.profile?.grade || '6'} 年級 | 
            <span class="badge-premium">👑 Pro 商用尊榮版</span>
          </p>
        </div>
      </div>
      <button class="print-btn" onclick="window.print()">
        🖨️ 匯出 PDF / 列印護照
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>當前自律總金幣</h3>
        <p class="points-val">💎 ${family.points} 點</p>
      </div>
      <div class="stat-card">
        <h3>最長連續自律連勤</h3>
        <p class="streak-val">🔥 ${family.streak} 天</p>
      </div>
      <div class="stat-card">
        <h3>累計隨堂答題數</h3>
        <p>${totalQuizCount} 題</p>
      </div>
    </div>

    <div class="section-title">🏆 兒童成長成就徽章牆</div>
    
    <div class="badges-container">
      ${ALL_BADGES.map(badge => {
        const isUnlocked = unlockedIds.includes(badge.id);
        const logItem = unlockedBadges.find(b => b.badgeId === badge.id);
        
        return `
          <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
            <div class="badge-icon">${badge.emoji}</div>
            <div class="badge-details">
              <h4>${badge.name} ${isUnlocked ? '' : '🔒'}</h4>
              <p>${badge.desc}</p>
              ${isUnlocked ? `
                <span class="badge-time">✓ 已解鎖 (${new Date(logItem.unlockedAt).toLocaleDateString('zh-TW')})</span>
              ` : `
                <span class="badge-time" style="color:var(--text-sec)">解鎖中...</span>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="ai-evaluation">
      <div class="ai-header">
        🤖 LearnMate AI 成長大數據反思評語
      </div>
      <div class="ai-content">
        親愛的家長與寶貝，根據本學期的自律連勤軌跡與點數增長動態，我們為寶貝送上專屬 AI 反思指引：
        <br><br>
        🌟 <b>學習力與自控力優勢：</b> 
        寶貝目前的最長連勤天數達到了令人讚嘆的 <b>${family.streak} 天</b>！這在心理學上已屬於大腦『自動自律神經網絡』初具規模的卓越表現。不僅如此，寶貝的答題量也成功累積到了 <b>${totalQuizCount} 題</b>，代表其在課堂知識吸收極具熱情與大腦耐力。
        <br><br>
        💡 <b>給孩子的溫暖加油：</b>
        『自律是世界上最強大的超能力！』恭喜你解鎖了 <b>${unlockedIds.length} 個</b> 專屬徽章！每一次答題、每一次習慣計時與打卡，都是你在為更好的自己投票。繼續保持連勤，向更厲害的徽章發起衝鋒吧！
        <br><br>
        🌱 <b>家長溫和陪伴指南：</b>
        建議在家庭餐會中，將這份「成長護照」列印出來貼在冰箱上，作為全家共同的自律勳章。著重稱讚孩子的『大腦耐力與打卡連勤軌跡』，以溫和支持代替焦慮催促，孩子的大腦將會自主釋放多巴胺，使習慣終身受用！
      </div>
    </div>

  </div>

</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>系統錯誤：${error.message}</h1>`);
  }
});

module.exports = router;
