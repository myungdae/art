const mongoose = require('mongoose');

const jobVacancySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job Title (URI) is required'],
    unique: true,
    trim: true,
    // ✅ 소문자 강제 제거됨 → 제거
    // lowercase: true
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
  datePosted: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('JobVacancy', jobVacancySchema);
