const mongoose = require('mongoose');

const jobSeekerSchema = new mongoose.Schema({
  name: { type: String, required: true },                       // 이름
  nationality: { type: String, required: true },                // 국적 (ex: Korea)
  major: { type: String },                                      // 전공 (ex: English Education)
  preferredWorkLocation: { type: String },                      // 희망 근무 지역 (ex: Seoul)
  educationBackground: { type: String },                        // 학생 유형 (ex: 대학생, 졸업생 등)
  availableFrom: { type: Date }                                 // 시작 가능일
});

module.exports = mongoose.model('JobSeeker', jobSeekerSchema);
