const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  type: { type: String, enum: ['daily', 'extra'], required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
  points: { type: Number, default: 10 },
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
