const mongoose = require('mongoose');

const onlineTutorSchema = new mongoose.Schema({
  // 🔹 핵심 정보
  name: { type: String, required: true },
  jobTitle: { type: String },
  description: { type: String },

  // 🔹 시맨틱 필수 요소 (4개)
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true,
  },
  expertise: {
    type: [String],
    enum: ['Grammar', 'Conversation', 'ExamPrep', 'BusinessEnglish'],
    required: true,
  },
  tutoringExperience: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    required: true,
  },
  communicationMethods: {
    type: [String],
    enum: ['Zoom', 'Skype', 'Email', 'GoogleMeet'],
    required: true,
  },

  // 🔹 일반 선택 정보
  email: { type: String },
  skypeId: { type: String },
  zoomId: { type: String },
  hourlyRate: { type: Number },
  availableFrom: { type: Date },
  availableTime: { type: String },
  languagesSpoken: { type: [String] }, // ✅ 시맨틱 제외, optional

  // 🔹 RDF용 타입
  '@type': {
    type: String,
    default: 'Online_Tutor',
  }
});

module.exports = mongoose.model('OnlineTutor', onlineTutorSchema);
