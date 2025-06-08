const express = require('express');
const router = express.Router();
// const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');

// ✅ Job Seekers 공개 목록
router.get('/Job_Seekers', async (req, res) => {
  // const seekers = await JobSeeker.find();
  res.render('public/job_seekers', { seekers });
});

// ✅ Online Tutors 공개 목록
router.get('/Online_Tutors', async (req, res) => {
  const tutors = await OnlineTutor.find();
  res.render('public/online_tutors', { tutors });
});

module.exports = router;

