const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  type: { type: String, enum: ['daily', 'extra'], required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
  points: { type: Number, default: 10 },
  questions: [{
    q: String,
    opts: [String],
    a: Number,
    exp: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
