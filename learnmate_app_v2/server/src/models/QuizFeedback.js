const mongoose = require('mongoose');

const quizFeedbackSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  subject: { type: String, required: true },
  q: { type: String, required: true }, // 有問題的題目題幹
  opts: [String], // 選項內容
  a: Number, // 正確答案索引
  userAnswer: Number, // 孩子作答答案索引
  feedback_type: {
    type: String,
    enum: ['wrong_answer', 'off_grade', 'unclear', 'other'],
    required: true
  }, // 回報問題類型：答案有誤、超出年級程度、語意不清、其他
  parent_note: { type: String, default: '' }, // 家長/教師建議備註
  status: { type: String, enum: ['pending', 'reviewed', 'fixed'], default: 'pending' }
}, { timestamps: true });

// 建立索引以便快速查詢
quizFeedbackSchema.index({ subject: 1, status: 1 });

module.exports = mongoose.model('QuizFeedback', quizFeedbackSchema);
