const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["Employer", "Job_Seeker", "Online_Tutor"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  adsAvailable: {
    type: Number,
    default: 0,
  },
  resumeAccess: {
    startDate: { type: Date },
    durationDays: { type: Number },
  },
  tutorAccess: {
    startDate: { type: Date },
    durationDays: { type: Number },
  },
});

module.exports = mongoose.model("User", userSchema);
