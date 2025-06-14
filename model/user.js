const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Employer', 'Job Seekers', 'Online Tutor'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  adsAvailable: {
    type: Number,
    default: 0
  },
  resumeAccess: {
    type: Boolean,
    default: false
  }

});

module.exports = mongoose.model('User', userSchema);
