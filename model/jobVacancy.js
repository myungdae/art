// model/jobVacancy.js
const mongoose = require('mongoose');

const jobVacancySchema = new mongoose.Schema({
  title: String,
  country: String,
  studentType: String,
  teachingArea: String,
  duration: String,
  pay: String,
  housing: String,
  datePosted: { type: Date, default: Date.now }
});

module.exports = mongoose.model('JobVacancy', jobVacancySchema);
