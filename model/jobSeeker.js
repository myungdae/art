const mongoose = require('mongoose');

const jobSeekerSchema = new mongoose.Schema({
  jobTitle: { type: String },                                    // 이력서 제목
  description: { type: String },                                 // 자기소개 내용
  name: { type: String, required: true },                        // 이름
  email: { type: String },                                       // 이메일
  nationality: { type: String, required: true },                 // 국적
  preferredWorkLocation: { type: String },                       // 희망 근무 지역
  major: { type: String },                                       // 전공
  languageSpoken: { type: String },                              // 구사 언어
  educationBackground: { type: String },                         // 학력 정보 (옵션)
  availableFrom: { type: Date }                                  // 시작 가능일
});

module.exports = mongoose.model('JobSeeker', jobSeekerSchema);
