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
      console.log('🆕 建立了新的家庭帳號:', familyCode);
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
      // 婉拒，退還點數
      reward.requests.pull(requestId);
      const family = await Family.findById(familyId);
      family.points += reward.cost;
      await family.save();
    }
    await reward.save();

    // 儲存家長留言
    if (message) {
      await Message.create({ familyId, text: message, from: 'parent' });
    }

    res.json({ success: true });
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
