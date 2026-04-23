const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  familyCode: { type: String, required: true, unique: true },
  childName: { type: String, required: true },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  profile: {
    grade: { type: String, default: '5' },
    editions: {
      type: Map,
      of: String,
      default: { '國語': '南一版', '數學': '康軒版', '社會': '翰林版', '自然': '翰林版', '英語': '康軒版' }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Family', familySchema);
