const mongoose = require('mongoose');

const jobVacancySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,       // ✅ 중복 방지
    trim: true,         
    lowercase: true,    // ✅ 자동 소문자 저장
    index: true         // ✅ 인덱스 재생성 보장
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
