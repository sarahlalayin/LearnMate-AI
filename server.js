require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const Family = require('./models/Family');
const Task = require('./models/Task');
const Reward = require('./models/Reward');
const Alert = require('./models/Alert');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());

// ── 靜態檔案服務 ───────────────────────────────
// Render 上：server.js 和 index_api.html 都在 repo 根目錄 (同一層)
// process.cwd() 取得 Node 執行目錄（在 Render 上就是 repo 根目錄）
// ★ index: 'index_api.html' 確保預設首頁是後端版，而非 index.html（本機版）
const STATIC_DIR = process.cwd();
app.use(express.static(STATIC_DIR, { index: 'index_api.html' }));

// 根路由 → 回傳 index_api.html
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index_api.html'));
});


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnmate';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 資料庫連線成功'))
  .catch(err => console.error('❌ MongoDB 連線失敗:', err));

// ── 通用 Gemini REST 呼叫函式 ──────────────────────────────
async function callGemini(prompt, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await resp.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // 強化 JSON 擷取，防止 Gemini 回覆夾雜其他說明文字導致 Parse 失敗
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (match) {
    text = match[0];
  } else {
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  }
  return text;
}

// ── YouTube Data API v3 工具函式 ──────────────────────────
// ISO 8601 時長 (PT5M30S) → '5分30秒'
function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
  if (h > 0) return `${h}小時${min}分`;
  if (min > 0 && s > 0) return `${min}分${s}秒`;
  if (min > 0) return `${min}分鐘`;
  return `${s}秒`;
}

// 用關鍵字搜尋 YouTube 影片（每次約 101 Quota Units）
// safeSearch=strict 確保兒童安全；videoEmbeddable=true 確保可嵌入
async function searchYouTubeVideo(keyword) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&videoEmbeddable=true&safeSearch=strict&relevanceLanguage=zh-TW&maxResults=1&key=${key}`;
    const searchData = await (await fetch(searchUrl)).json();
    if (!searchData.items?.length) return null;
    const item = searchData.items[0];
    const videoId = item.id.videoId;
    // 取得時長（1 Quota Unit）
    const detailData = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`)).json();
    const duration = parseDuration(detailData.items?.[0]?.contentDetails?.duration);
    return {
      videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      duration
    };
  } catch(e) {
    console.error('YouTube API 失敗:', e.message);
    return null;
  }
}


// ── Prompts ────────────────────────────────────────────────
function buildQuizPrompt(subject, topic, grade, edition, count = 5) {
  return `你是一位專業的台灣小學${grade}年級${subject}老師，使用${edition}教材。
請根據單元主題「${topic}」，生成 ${count} 題繁體中文單選練習題。

嚴格規則：
1. 題目必須符合${grade}年級程度，語氣友善親切。
2. 必須提供 4 個不同的「實際答案選項內容」，且選項文字不可加上 A/B/C/D 前綴。
3. 只有 1 個正確答案，正確答案的索引 (a) 必須是 0 到 3 之間的整數。
4. 必須包含簡短易懂的解析（30字內）。
5. 必須只回傳 JSON 陣列，絕對不能包含任何 Markdown 語法或說明文字。

JSON 格式範例：
[
  {
    "q": "這是一道測驗題目？",
    "opts": ["選項內容一", "選項內容二", "選項內容三", "選項內容四"],
    "a": 1,
    "exp": "因為這是正確的解釋。"
  }
]`;
}

function buildVideoPrompt(grade, editions, weakSubjects, topics) {
  // 建立「科目: 版本」的字串對照表，供 Gemini 參考
  let editionsStr = '';
  if (editions) {
    try {
      const entries = editions instanceof Map ? Array.from(editions.entries()) : Object.entries(editions);
      editionsStr = entries.map(([sub, ed]) => `${sub}(${ed})`).join('、');
    } catch(e) {}
  }
  
  return `你是台灣小學${grade}年級學習顧問，請針對以下情況推薦 3 個適合的 YouTube 學習影片主題。

學生資訊：
- 年級：${grade}年級
- 各科對應教材版本：${editionsStr || '無特定版本'}
- 需要加強的科目：${weakSubjects}
- 目前學習主題：${topics}

請依據學生的「年級」與對應科目的「教材版本」，精準推測最適合的教學影片關鍵字。
請以 JSON 格式回傳，只回傳 JSON，不要有其他文字：
[{"title":"影片標題（繁體中文，生動有趣）","channel":"推薦頻道名稱（台灣教育頻道）","keyword":"YouTube搜尋關鍵字（必須包含年級、科目、單元與精準的教材版本）","subject":"科目","duration":"預估時長","desc":"一句話推薦理由"}]`;
}

function buildInsightPrompt(childName, grade, completionRate, accuracyData, skipped, hasExtra) {
  return `你是 LearnMate 學習助理，請根據以下數據，用繁體中文寫一段 80-100 字的家長學習週報（溫暖專業語氣）。
包含：1. 整體表現摘要  2. 一個具體可執行的建議
不要出現「AI」字樣，語氣像親切的老師對家長說話。

學生：${childName}，${grade}年級
完成率：${completionRate}%
各科正確率：${accuracyData}
跳過科目：${skipped || '無'}
已有加強題：${hasExtra ? '是' : '否'}

只回傳週報文字，不要 JSON 也不要標題。`;
}

// ==========================================
// API 路由
// ==========================================

// 1. 登入與初始化
app.post('/api/auth/login', async (req, res) => {
  try {
    const { familyCode } = req.body;
    let family = await Family.findOne({ familyCode });
    if (!family) {
      family = await Family.create({ familyCode, childName: '小明', points: 320, streak: 5 });
      await Task.insertMany([
        { familyId: family._id, subject: '國語', topic: 'L5 詞語複習', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '數學', topic: '分數加減', type: 'daily', totalQuestions: 5 },
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
app.get('/api/tasks/:familyId', async (req, res) => {
  try {
    const tasks = await Task.find({ familyId: req.params.familyId });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. AI 考題生成 ★ 核心功能
app.post('/api/tasks/generate', async (req, res) => {
  try {
    const { subject, topic, grade, edition, familyId, count = 5 } = req.body;
    const prompt = buildQuizPrompt(subject, topic, grade || '5', edition || '通用版', count);

    let questions = null;
    const rawText = await callGemini(prompt);
    if (rawText) {
      try { questions = JSON.parse(rawText); } catch (e) { questions = null; }
    }

    // Fallback mock questions
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      questions = Array.from({ length: count }, (_, i) => ({
        q: `【${subject}】關於「${topic}」的第 ${i + 1} 題`,
        opts: ['選項 A', '選項 B', '選項 C', '選項 D'],
        a: 0,
        exp: `正確答案是選項 A。（離線示範題）`
      }));
    }

    const newTask = await Task.create({
      familyId, type: 'extra', subject, topic,
      totalQuestions: questions.length,
      questions,
      aiGenerated: !!rawText,
      promptParams: { grade: grade || '5', edition: edition || '通用版' }
    });

    res.json({ success: true, task: newTask, aiGenerated: !!rawText });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. ★ AI 影片推薦（新路由）
app.post('/api/videos/recommend', async (req, res) => {
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
app.post('/api/insights/report', async (req, res) => {
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
app.get('/api/rewards/:familyId', async (req, res) => {
  try {
    const rewards = await Reward.find({ familyId: req.params.familyId });
    res.json({ success: true, rewards });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 許願新獎勵 (學生端)
app.post('/api/rewards/propose', async (req, res) => {
  try {
    const { familyId, name, icon } = req.body;
    const newReward = await Reward.create({ familyId, name, icon, cost: 0, proposedBy: 'student', status: 'proposed' });
    await Alert.create({ familyId, type: 'positive', title: `✨ 新獎勵許願：${name}`, desc: `孩子提議將「${icon} ${name}」加入清單，快去設定點數吧！` });
    res.json({ success: true, reward: newReward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 申請兌換獎勵 (學生端)
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
      await Alert.create({ familyId, type: 'positive', title: `🎁 兌換申請：${reward.name}`, desc: `孩子花費了 ${reward.cost} 點申請兌換「${reward.icon} ${reward.name}」。` });
      res.json({ success: true, points: family.points });
    } else {
      res.status(400).json({ success: false, error: '點數不足' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. 審核獎勵 (家長端)
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
    if (message) await Message.create({ familyId, text: message, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. 標記已使用獎勵
app.post('/api/rewards/use', async (req, res) => {
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
app.post('/api/profile/update', async (req, res) => {
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
app.post('/api/messages/send', async (req, res) => {
  try {
    const { familyId, text } = req.body;
    await Message.create({ familyId, text, from: 'parent' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. 完成測驗（★ 新增 streak 和正確率更新）
app.post('/api/tasks/complete', async (req, res) => {
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
app.post('/api/tasks/skip', async (req, res) => {
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

// 15. 同步完整狀態
app.get('/api/sync/:familyId', async (req, res) => {
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
        subjectAccuracy: Object.fromEntries(family.subjectAccuracy || new Map()), // ★ 真實正確率
        tasks: tasks.filter(t => t.type === 'daily'),
        extraTasks: tasks.filter(t => t.type === 'extra'),
        rewards,
        rewardRequests: rewards.flatMap(r =>
          r.requests.map(req => ({ ...req.toObject(), rewardId: r._id, _id: req._id.toString() }))
        ),
        alerts,
        messages: messages.map(m => m.text)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 其他 GET 路由回到首頁（避免重新整理出現 404）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(STATIC_DIR, 'index_api.html'));
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 LearnMate 伺服器已啟動於 port ${PORT}`);
  console.log(`✅ AI 功能：Gemini 2.0 Flash / 考題生成 / 影片推薦 / 週報分析`);
  console.log(`🌐 前端頁面會暴露於 http://localhost:${PORT}`);
});
