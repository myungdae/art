// model/onlinetutor.js
const mongoose = require('mongoose');

const onlineTutorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nationality: { type: String, required: true },

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

  availableFrom: { type: Date, required: true },
  availableTime: { type: String }, // e.g., "12:00"

  '@type': {
    type: String,
    default: 'Online_Tutors',
  }
});

module.exports = mongoose.model('OnlineTutor', onlineTutorSchema);
