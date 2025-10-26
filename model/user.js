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
    enum: ["Employer", "Job_Seeker", "Online_Tutor", "Admin"],
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
  // 계정 만료 알림 관련 필드
  expiryNotifications: {
    day90Sent: { type: Boolean, default: false },
    day110Sent: { type: Boolean, default: false },
  },
  resumeAccess: {
    startDate: { type: Date },
    durationDays: { type: Number },
  },
  tutorAccess: {
    startDate: { type: Date },
    durationDays: { type: Number },
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
});

module.exports = mongoose.model("User", userSchema);
