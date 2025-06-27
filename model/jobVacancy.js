const mongoose = require('mongoose');

const jobVacancySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job Title is required'],
    trim: true
  },
  _label: {
    type: String,
    required: [true, 'Job Title (_label) is required'],
    trim: true
  },
  description: { type: String },
  _description: { type: String },
  country: { type: String },
  studentType: { type: String },
  teachingArea: { type: String },
  duration: { type: String },
  pay: { type: String },
  housing: { type: String },
  email: { type: String },
  companyName: { type: String },
  jobLocation: { type: String },
  cellphoneNumber: { type: String },
  skypeId: { type: String },
  wechatId: { type: String },
  homepage: { type: String },
  adPackage: { type: String },
  addResumeAccess: { type: Boolean },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  datePosted: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('JobVacancy', jobVacancySchema);
