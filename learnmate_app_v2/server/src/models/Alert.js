const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  type: { type: String, enum: ['critical', 'warning', 'positive'], required: true },
  title: { type: String, required: true },
  desc: { type: String, required: true },
  action: { type: String } // optional link context
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
