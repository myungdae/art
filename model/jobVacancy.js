const mongoose = require('mongoose');

// ✅ Job Vacancy Schema 정의
const jobVacancySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job Title (URI) is required'],
    unique: true,  // 중복 방지
    trim: true     // 공백 제거
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
  timestamps: true  // createdAt, updatedAt 자동 생성
});

// ✅ 모델 export
module.exports = mongoose.model('JobVacancy', jobVacancySchema);
