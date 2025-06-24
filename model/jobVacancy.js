const mongoose = require('mongoose');

const jobVacancySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job Title (URI) is required'],
    unique: true,
    trim: true
  },
  description: { type: String },
  country: { type: String },
  studentType: { type: String },
  teachingArea: { type: String },
  duration: { type: String },
  pay: { type: String },
  housing: { type: String },
  email: { type: String },
  companyName: { type: String },
  jobLocation: { type: String },
  cellphoneNumber: { type: String },
  skypeId: { type: String },
  wechatId: { type: String },
  homepage: { type: String },

  // ✅ NEW: Payment-related fields
  adPackage: { type: String }, // '1', '4', '12', '24'
  addResumeAccess: { type: Boolean }, // true if checked

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  datePosted: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('JobVacancy', jobVacancySchema);
