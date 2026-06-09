const mongoose = require('mongoose');
const questionSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  grade: { type: String, default: '6' },
  edition: { type: String, default: '通用版' },
  unit: { type: String },
  q: { type: String, required: true },
  opts: [String],
  a: Number,
  exp: String,
  
  // 品質監控報錯率用 (Phase E)
  attemptsCount: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  isBlacklisted: { type: Boolean, default: false }
}, { timestamps: true });
questionSchema.index({ subject: 1, grade: 1, edition: 1 });
module.exports = mongoose.model('Question', questionSchema);
