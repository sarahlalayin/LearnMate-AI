const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
  name: { type: String, required: true },
  cost: { type: Number, default: 0 },
  icon: { type: String, default: '🎁' },
  proposedBy: { type: String, enum: ['student', 'parent'], required: true },
  status: { type: String, enum: ['ready', 'proposed'], default: 'ready' },
  // Requests to redeem this reward
  requests: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);
