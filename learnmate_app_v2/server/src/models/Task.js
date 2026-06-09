const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  type: { type: String, enum: ['daily', 'extra'], required: true },
  item_type: { type: String, enum: ['academic', 'habit'], default: 'academic' }, // 區分學業與習慣
  subject: { type: String, required: true },
  topic: { type: String, required: false, default: '' }, // 習慣無課本主題，改為非強制
  status: { type: String, enum: ['pending', 'submitted', 'completed', 'skipped'], default: 'pending' },
  points: { type: Number, default: 10 },
  earnedPoints: { type: Number, default: 0 },
  
  // 習慣打卡專用欄位配置 (Phase B1)
  habit_config: {
    category: { type: String, enum: ['sport', 'music', 'reading', 'lifestyle', 'other'], default: 'other' },
    target_unit: { type: String, default: '分鐘' },
    target_value: { type: Number, default: 20 },
    actual_value: { type: Number, default: 0 },
    child_note: { type: String, default: '' },
    parent_confirmed: { type: Boolean, default: false },
    parent_note: { type: String, default: '' }
  }, // ★ 學生答題累積的分數（送審時存入）
  isActivity: { type: Boolean, default: false }, // ★ 是否為非學科習慣打卡
  totalQuestions: { type: Number, default: 5 },
  questions: [{
    q: String,
    opts: [String],
    a: Number,
    exp: String
  }],
  // AI 生成標記
  aiGenerated: { type: Boolean, default: false },
  // 生成時使用的 prompt 參數（方便日後審計）
  promptParams: {
    grade: String,
    edition: String,
    difficulty: { type: String, default: '中等' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
