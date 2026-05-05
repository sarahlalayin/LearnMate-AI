const mongoose = require('mongoose');

const activityTemplateSchema = new mongoose.Schema({
  category: { type: String, required: true }, // e.g. "運動", "才藝", "家事"
  title: { type: String, required: true }, // e.g. "跳繩500下", "練鋼琴30分鐘"
  defaultPoints: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = mongoose.model('ActivityTemplate', activityTemplateSchema);
