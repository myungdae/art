// router/admin.js

const express = require('express');
const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');

// ✅ 모델 불러오기 (❗ 반드시 필요)
const JobVacancy = require('../model/jobVacancy');
const JobSeeker = require('../model/jobSeeker');
const Tutor = require('../model/tutor');

// ✅ 관리자 로그인 페이지
router.get('/login', (req, res) => {
  res.render('admin/login');  // views/admin/login.pug
});

// ✅ 로그인 처리
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (email === adminEmail && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  } else {
    return res.render('admin/login', { error: 'Invalid email or password.' });
  }
});

// ✅ 관리자 대시보드 (통계 포함)
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [jobVacancyCount, jobSeekerCount, tutorCount] = await Promise.all([
      JobVacancy.countDocuments(),
      JobSeeker.countDocuments(),
      Tutor.countDocuments()
    ]);

    const jobSeekers = await JobSeeker.find();
    const tutors = await Tutor.find();

    res.render('admin/dashboard', {
      jobVacancyCount,
      jobSeekerCount,
      tutorCount,
      jobSeekers,
      tutors,
      currentDate: new Date().toLocaleDateString()
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
