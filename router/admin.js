const express = require('express');
const router = express.Router();

const JobVacancy = require('../model/jobVacancy');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');
const requireAdmin = require('../middleware/requireAdmin');

// ✅ 관리자 로그인 페이지
router.get('/login', (req, res) => {
  res.render('admin/login');
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

// ✅ 로그아웃 처리
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// ✅ 관리자 대시보드
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const jobVacancies = await JobVacancy.find().sort({ createdAt: -1 });
    const jobSeekers = await JobSeeker.find().sort({ createdAt: -1 });
    const onlineTutors = await OnlineTutor.find().sort({ _id: -1 }); // 최신순

    res.render('admin/dashboard', {
      jobVacancies,
      jobSeekers,
      onlineTutors
    });
  } catch (err) {
    console.error('❌ Admin dashboard error:', err);
    res.status(500).render('error', {
      message: 'Admin Dashboard Error',
      error: err
    });
  }
});

module.exports = router;
