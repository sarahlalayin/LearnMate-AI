const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  // 會員帳號基本資訊
  email: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String }, // Bcrypt hash
  
  // 第三方登入 SSO 識別碼
  appleId: { type: String, unique: true, sparse: true },
  googleId: { type: String, unique: true, sparse: true },
  
  // 家長防護欄與 COPPA 驗證
  parentVerified: { type: Boolean, default: false },
  parentVerificationCode: { type: String, default: null },
  parentVerificationExpires: { type: Date, default: null },

  // 訂閱狀態（Phase C 提早部署，防後續遷移）
  subscription: {
    plan: { type: String, enum: ['free', 'pro', 'team'], default: 'free' },
    status: { type: String, enum: ['active', 'expired', 'trial', 'cancelled'], default: 'expired' },
    trial_ends_at: { type: Date, default: null },
    current_period_end: { type: Date, default: null },
    revenuecat_id: { type: String, default: null },
    platform: { type: String, enum: ['ios', 'android', 'web'], default: 'web' }
  },
  
  // 段考複習模式設定 (Phase D2)
  examPrep: {
    examDate: { type: Date, default: null },
    countdownActive: { type: Boolean, default: false },
    subjects: [{
      subjectName: { type: String },
      range: { type: String, default: '全範圍' }
    }]
  },

  // 成長護照所獲得的徽章牆 (Phase D3)
  badges: [{
    badgeId: { type: String },         // 'b1' ~ 'b6'
    name: { type: String },            // 徽章名稱
    description: { type: String },     // 徽章獲得描述
    unlockedAt: { type: Date, default: Date.now }
  }],

  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null }, // 綁定班級教師 (Phase E)

  familyCode: { type: String, required: false, unique: true, sparse: true }, // 保持相容性，改為非強制
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
    },
    progressOffset: {
      type: Map,
      of: Number,
      default: {}
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
  },
  // ★ 家長自訂非學科習慣（才藝/運動/家事）
  customActivities: [{
    name:     { type: String, required: true },
    category: { type: String, enum: ['才藝','運動','家事','其他'], default: '其他' },
    icon:     { type: String, default: '⭐' },
    points:   { type: Number, default: 10 }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Family', familySchema);
