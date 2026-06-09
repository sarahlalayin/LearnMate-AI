const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Bcrypt hash
  name: { type: String, required: true },
  schoolName: { type: String, default: '愛智安親班' },
  classCode: { type: String, unique: true } // 班級特有代碼，用於學生綁定
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
