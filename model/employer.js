const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  adsAvailable: {
    type: Number,
    default: 0
  },
  planType: {
    type: String,
    enum: ['basic', 'premium', 'vip'],
    default: 'basic'
  },
  lastPaymentDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Employer', employerSchema);
