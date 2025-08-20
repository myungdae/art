const mongoose = require('mongoose');

const JobVacancySchema = new mongoose.Schema({
  title: String,
  description: String,
  country: String,
  studentType: String,
  teachingArea: String,
  duration: String,
  pay: String,
  housing: String,
  email: String,
  companyName: String,
  jobLocation: String,
  cellphoneNumber: String,
  skypeId: String,
  wechatId: String,
  homepage: String,
  datePosted: Date,

  adCount: { type: Number, default: 1 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },

  // 만료일: 쿼리 필터/정렬용 인덱스 (TTL로 지우지는 않음)
  expiresAt: { type: Date, index: true },

  status: { type: String, default: 'active' },
});

module.exports = mongoose.model('JobVacancy', JobVacancySchema);
