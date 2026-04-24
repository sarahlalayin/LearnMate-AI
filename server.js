require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Import Models
const Family = require('./models/Family');
const Task = require('./models/Task');
const Reward = require('./models/Reward');
const Alert = require('./models/Alert');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());

// 準備 Gemini API (金鑰將透過環境變數注入)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

// 連線至 MongoDB (本機或 Atlas)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnmate';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 資料庫連線成功'))
  .catch(err => console.error('❌ MongoDB 連線失敗:', err));

// ==========================================
// 核心 API 路由 (Routes)
// ==========================================

// 1. 登入與初始化家庭資料
app.post('/api/auth/login', async (req, res) => {
  try {
    const { familyCode } = req.body;
    let family = await Family.findOne({ familyCode });
    
    // 為了展示方便，如果找不到該家庭代碼，就自動建立一個預設的
    if (!family) {
      family = await Family.create({ 
        familyCode, 
        childName: '小明',
        points: 320,
        streak: 5
      });
      
      // 建立預設任務
      const defaultTasks = [
        { familyId: family._id, subject: '國語', topic: 'L1 詞語複習', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '數學', topic: '單元1 加減法', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '英語', topic: 'Unit 1 單字', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '自然', topic: '第一章 觀測', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '社會', topic: 'L1 家鄉', type: 'daily', totalQuestions: 5 }
      ];
      await Task.insertMany(defaultTasks);

      // 建立預設獎勵
      const defaultRewards = [
        { familyId: family._id, name: '玩 Switch 30分鐘', cost: 100, proposedBy: 'parent', icon: '🎮' },
        { familyId: family._id, name: '看卡通一集', cost: 50, proposedBy: 'parent', icon: '📺' },
        { familyId: family._id, name: '週末去公園', cost: 300, proposedBy: 'parent', icon: '⚽' }
      ];
      await Reward.insertMany(defaultRewards);

      console.log('🆕 建立了新的家庭帳號並初始化課表與獎勵:', familyCode);
    }
    
    res.json({ success: true, family });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 取得今日任務列表
app.get('/api/tasks/:familyId', async (req, res) => {
  try {
    const tasks = await Task.find({ familyId: req.params.familyId });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. AI 考題生成 API (使用 Gemini)
app.post('/api/tasks/generate', async (req, res) => {
  try {
    const { subject, topic, grade, edition, familyId } = req.body;
    
    // 如果沒有設定 API Key，則回傳測試用的假資料 (方便您在設定前測試)
    if (!process.env.GEMINI_API_KEY) {
      const mockQuestions = [
        { q: `關於${subject}的「${topic}」測試題`, opts: ['A', 'B', 'C', 'D'], a: 0, exp: '因為這是測試模式。' }
      ];
      const newTask = await Task.create({
        familyId, type: 'extra', subject, topic, questions: mockQuestions
      });
      return res.json({ success: true, task: newTask });
    }

    // 呼叫真實的 Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `你是專業的小學老師。請根據科目「${subject}」，主題「${topic}」（適用於 ${grade} 年級，${edition}），產生 4 題單選題。
請嚴格使用 JSON 格式回傳，格式如下：
[{"q": "題目", "opts": ["選項A", "選項B", "選項C", "選項D"], "a": 正確選項的索引(0-3), "exp": "簡單易懂的解析"}]`;
    
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(text);

    // 存入資料庫
    const newTask = await Task.create({
      familyId, type: 'extra', subject, topic, questions
    });

    res.json({ success: true, task: newTask });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 取得獎勵清單
app.get('/api/rewards/:familyId', async (req, res) => {
  try {
    const rewards = await Reward.find({ familyId: req.params.familyId });
    res.json({ success: true, rewards });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 許願新獎勵 (學生端)
app.post('/api/rewards/propose', async (req, res) => {
  try {
    const { familyId, name, icon } = req.body;
    const newReward = await Reward.create({
      familyId, name, icon, cost: 0, proposedBy: 'student', status: 'proposed'
    });
    // 新增通知給家長
    await Alert.create({
      familyId, type: 'positive', title: `✨ 新獎勵許願：${name}`, desc: `孩子提議將「${icon} ${name}」加入清單，快去設定點數吧！`
    });
    res.json({ success: true, reward: newReward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. 申請兌換獎勵 (學生端)
app.post('/api/rewards/claim', async (req, res) => {
  try {
    const { familyId, rewardId } = req.body;
    const reward = await Reward.findById(rewardId);
    const family = await Family.findById(familyId);
    
    if (family.points >= reward.cost) {
      family.points -= reward.cost;
      await family.save();
      
      reward.requests.push({ status: 'pending' });
      await reward.save();

      await Alert.create({
        familyId, type: 'positive', title: `🎁 兌換申請：${reward.name}`, desc: `孩子花費了 ${reward.cost} 點申請兌換「${reward.icon} ${reward.name}」。`
      });
      res.json({ success: true, points: family.points });
    } else {
      res.status(400).json({ success: false, error: '點數不足' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 審核獎勵與留言 (家長端)
app.post('/api/rewards/approve', async (req, res) => {
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

    if (message) {
      await Message.create({ familyId, text: message, from: 'parent' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7-1. 學生標記已使用獎勵 (從清單移除)
app.post('/api/rewards/use', async (req, res) => {
  try {
    const { rewardId, requestId } = req.body;
    const reward = await Reward.findById(rewardId);
    if(reward) {
      reward.requests.pull(requestId);
      await reward.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 儲存家長設定 (Profile)
app.post('/api/profile/update', async (req, res) => {
  try {
    const { familyId, grade, editions } = req.body;
    await Family.findByIdAndUpdate(familyId, { profile: { grade, editions } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. 傳送家長留言
app.post('/api/messages/send', async (req, res) => {
  try {
    const { familyId, text } = req.body;
    await Message.create({ familyId, text, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. 完成測驗/更新點數
app.post('/api/tasks/complete', async (req, res) => {
  try {
    const { familyId, taskId, pointsToAdd } = req.body;
    if(taskId) {
      await Task.findByIdAndUpdate(taskId, { status: 'completed' });
    }
    const family = await Family.findById(familyId);
    family.points += pointsToAdd;
    await family.save();
    res.json({ success: true, points: family.points });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. 跳過任務
app.post('/api/tasks/skip', async (req, res) => {
  try {
    const { familyId, taskId, reason } = req.body;
    const task = await Task.findByIdAndUpdate(taskId, { status: 'skipped' });
    const family = await Family.findById(familyId);
    family.points = Math.max(0, family.points - 5);
    await family.save();

    let alertType = 'warning';
    let alertTitle = `${task.subject} — 暫停`;
    let alertDesc = `孩子因為「${reason}」暫停了這科。`;

    if(reason === '看不懂') {
      alertType = 'critical';
      alertTitle = `${task.subject} — 需要神隊友救援 🚨`;
      alertDesc = '孩子誠實地表示這科看不懂，這是一個很棒的自我察覺！建議今晚先給他一個擁抱，再一起看看哪裡卡住了。';
    } else if(reason === '功課太多') {
      alertTitle = `${task.subject} — 功課太多暫停`;
      alertDesc = `孩子覺得學校功課太多，選擇先讓大腦休息。請給予他的時間管理肯定！`;
    }

    await Alert.create({ familyId, type: alertType, title: alertTitle, desc: alertDesc });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 同步完整資料庫狀態 (給前端統一看板使用)
app.get('/api/sync/:familyId', async (req, res) => {
  try {
    const familyId = req.params.familyId;
    const family = await Family.findById(familyId);
    if (!family) return res.status(404).json({ success: false, error: '找不到家庭' });

    const tasks = await Task.find({ familyId });
    const rewards = await Reward.find({ familyId });
    const alerts = await Alert.find({ familyId }).sort({ createdAt: -1 });
    const messages = await Message.find({ familyId }).sort({ createdAt: 1 });

    const db = {
      familyId: family._id,
      childName: family.childName,
      profile: family.profile,
      points: family.points,
      streak: family.streak,
      tasks: tasks.filter(t => t.type === 'daily'),
      extraTasks: tasks.filter(t => t.type === 'extra'),
      rewards: rewards,
      // 展開所有的 requests 並加上 rewardId
      rewardRequests: rewards.flatMap(r => r.requests.map(req => ({ ...req.toObject(), rewardId: r._id, _id: req._id.toString() }))),
      alerts: alerts,
      messages: messages.map(m => m.text)
    };

    res.json({ success: true, db });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 啟動伺服器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 LearnMate 伺服器已啟動於 port ${PORT}`);
  console.log(`- 準備好接收前端請求`);
});
