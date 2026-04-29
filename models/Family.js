const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  familyCode: { type: String, required: true, unique: true },
  childName: { type: String, required: true },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },

  // ★ 連續天數自動更新用
  lastActiveDate: { type: String, default: null }, // 格式：'YYYY-MM-DD'（台灣時區）

  // ★ 各科正確率（累計加權平均）
  // 格式：{ '英語': 72, '數學': 88, '自然': 65, ... }（百分比）
  subjectAccuracy: {
    type: Map,
    of: Number,
    default: {}
  },

  // 各科答題次數（用來計算加權平均）
  subjectQuizCount: {
    type: Map,
    of: Number,
    default: {}
  },

  profile: {
    grade: { type: String, default: '5' },
    editions: {
      type: Map,
      of: String,
      default: { '國語': '南一版', '數學': '康軒版', '社會': '翰林版', '自然': '翰林版', '英語': '康軒版' }
    }
  },

  // AI 推薦影片快取（避免頻繁呼叫 YouTube API，節省 Quota）
  videoRecommendations: {
    cachedAt: { type: Date, default: null },
    videos: [{
      videoId: String,        // YouTube video ID（用於嵌入播放）
      title: String,
      channel: String,
      thumbnail: String,      // 縮圖 URL
      duration: String,       // 格式化後的時長，例如 '5分30秒'
      subject: String,
      desc: String,           // Gemini 生成的推薦理由
      keyword: String         // 原始搜尋關鍵字
    }]
  }
}, { timestamps: true });

module.exports = mongoose.model('Family', familySchema);
