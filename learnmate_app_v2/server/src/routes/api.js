require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const Family = require('../models/Family');
const Task = require('../models/Task');
const Reward = require('../models/Reward');
const Alert = require('../models/Alert');
const Message = require('../models/Message');
const Syllabus = require('../models/Syllabus');
const ActivityTemplate = require('../models/ActivityTemplate');
const Question = require('../models/Question');
const { callGemini, buildQuizPrompt, buildVideoPrompt, buildInsightPrompt } = require('../services/aiService');
const { searchYouTubeVideo } = require('../services/youtubeService');


const router = express.Router();

// ==========================================
// API 路由
// ==========================================

// 1. 登入與初始化
router.post('/api/auth/login', async (req, res) => {
  try {
    const { familyCode } = req.body;
    let family = await Family.findOne({ familyCode });
    if (!family) {
      family = await Family.create({ familyCode, childName: '小明', points: 320, streak: 5, profile: { grade: '6', editions: { '數學': '康軒版', '國語': '南一版', '英語': '康軒版', '社會': '翰林版', '自然': '翰林版' } } });
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
    }
    res.json({ success: true, family });
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

// 3. AI 考題生成 ★ 核心功能（優先從題庫抽題）
router.post('/api/tasks/generate', async (req, res) => {
  try {
    const { subject, topic, grade, edition, familyId, count = 5 } = req.body;

    // Step 1: 先從題庫 DB 隨機抽題
    const dbQuestions = await Question.find({ subject, grade: grade || '6' });
    console.log(`📚 [題庫] ${subject} 找到 ${dbQuestions.length} 題`);

    let questions = null;
    let fromDB = false;

    if (dbQuestions.length >= count) {
      const shuffled = [...dbQuestions].sort(() => Math.random() - 0.5);
      questions = shuffled.slice(0, count).map(q => ({ q: q.q, opts: q.opts, a: q.a, exp: q.exp }));
      fromDB = true;
      console.log(`✅ [題庫] 從 DB 隨機抽取 ${count} 題`);
    } else {
      // Step 2: 題庫不足，嘗試 Gemini AI
      console.log(`⚠️ [題庫] 題目不足，改用 AI 生成`);
      const syllabus = await Syllabus.findOne({ grade: grade || '6', subject, edition: edition || '通用版' });
      const prompt = buildQuizPrompt(subject, topic, grade || '6', edition || '通用版', count, syllabus?.content);
      const rawText = await callGemini(prompt);
      if (rawText) {
        try { questions = JSON.parse(rawText); } catch (e) { questions = null; }
      }

      // Step 3: 最終 Fallback
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        questions = Array.from({ length: count }, (_, i) => ({
          q: `【${subject}】第 ${i + 1} 題（請至後台新增題庫）`,
          opts: ['選項 A', '選項 B', '選項 C', '選項 D'],
          a: 0, exp: '請管理員至後台補充題庫。'
        }));
      }
    }

    const newTask = await Task.create({
      familyId, type: 'extra', subject, topic,
      totalQuestions: questions.length,
      questions,
      aiGenerated: !fromDB,
      promptParams: { grade: grade || '6', edition: edition || '通用版' }
    });

    res.json({ success: true, task: newTask, fromDB, aiGenerated: !fromDB });
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
router.post('/api/videos/recommend', async (req, res) => {
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

module.exports = router;
