const mongoose = require('mongoose');

const jobSeekerSchema = new mongoose.Schema({
  name: { type: String, required: true },               // 이름 (UI에 prominently 표시됨)
  jobTitle: { type: String },                           // 한 줄 요약 (ex. English Teaching Support)
  description: { type: String },                        // 자기소개
  nationality: { type: String, required: true },        // 국적
  preferredWorkLocation: { type: String },              // 희망 근무 지역
  major: { type: String },                              // 전공
  email: { type: String },                              // 이메일
  languageSpoken: { type: String },                     // 구사 언어
  educationBackground: { type: String },                // 학력
  availableFrom: { type: Date }                         // 시작 가능일
}, { timestamps: true });  // ✅ createdAt, updatedAt 자동 생성

module.exports = mongoose.model('JobSeeker', jobSeekerSchema);
