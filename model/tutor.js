const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  name: { type: String, required: true },               // 이름
  expertise: { type: String },                          // 전공 또는 분야 (예: 수학, 영어)
  nationality: { type: String },                        // 국적
  availableDays: { type: String },                      // 가능한 요일/시간
  contactEmail: { type: String }                        // 이메일 (선택)
});

module.exports = mongoose.model('Tutor', tutorSchema);

