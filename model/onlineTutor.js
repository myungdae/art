const mongoose = require('mongoose');

const onlineTutorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nationality: { type: String, required: true },
  gender: { type: String },
  expertise: [String],                  // subjects like Math, English, etc.
  tutoringExperience: { type: String }, // ex: "3 years teaching high school"
  communicationMethods: [String],      // ex: ["Zoom", "Skype"]
  availableTime: { type: String },      // ex: "Evenings", "Weekends"
  availableFrom: { type: Date }
});

module.exports = mongoose.model('OnlineTutor', onlineTutorSchema);

