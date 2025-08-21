// model/jobVacancy.js
const mongoose = require('mongoose');

const jobVacancySchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Job Title is required'], trim: true },
  _label:{ type: String, required: [true, 'Job Title (_label) is required'], trim: true },

  description: { type: String },
  _description:{ type: String },

  country:     { type: String, trim: true },
  studentType: { type: String, trim: true },

  // ✅ 배열로 통일
  teachingArea:{ type: [String], default: [] },

  duration:        { type: String, trim: true },
  pay:             { type: String, trim: true },
  housing:         { type: String, trim: true },
  email:           { type: String, trim: true },
  companyName:     { type: String, trim: true },
  jobLocation:     { type: String, trim: true },
  cellphoneNumber: { type: String, trim: true },
  homepage:        { type: String, trim: true },

  adPackage: { type: String, trim: true },

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  datePosted: { type: Date, default: Date.now }
}, { timestamps: true });

// _label 자동 세팅
jobVacancySchema.pre('validate', function(next) {
  if (!this._label && this.title) this._label = this.title;
  next();
});

module.exports = mongoose.model('JobVacancy', jobVacancySchema);
