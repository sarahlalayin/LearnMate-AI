const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  subject: { type: String, required: true },
  grade: { type: String, default: '6' },
  topic: { type: String },
  q: { type: String, required: true },
  opts: [String],
  a: Number, // 正確答案索引 (0-3)
  exp: String, // 題目解析
  userAnswer: Number, // 孩子作答時答錯的選項索引
  incorrectCount: { type: Number, default: 1 }, // 答錯次數
  lastAttemptedAt: { type: Date, default: Date.now }
}, { timestamps: true });

errorLogSchema.index({ familyId: 1, subject: 1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
