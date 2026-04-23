const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  text: { type: String, required: true },
  from: { type: String, enum: ['parent', 'system'], default: 'parent' }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
