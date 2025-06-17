const mongoose = require('mongoose');
const { Schema } = mongoose;

const resumeAccessSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessType: {
    type: String,
    enum: ['30', '90', '365'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ResumeAccess', resumeAccessSchema);

