const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');  // Employer 역할
const JobSeeker = require('../model/jobSeeker');    // Job Seeker 역할
const Tutor = require('../model/onlineTutor');       // Online Tutor 역할

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

// ✅ 관리자 대시보드 (통계 + 사용자 목록 포함)
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [jobVacancyCount, jobSeekerCount, tutorCount] = await Promise.all([
      JobVacancy.countDocuments(),
      JobSeeker.countDocuments(),
      Tutor.countDocuments()
    ]);

    const [employers, jobSeekers, tutors] = await Promise.all([
      JobVacancy.find().sort({ createdAt: -1 }),
      JobSeeker.find().sort({ createdAt: -1 }),
      Tutor.find().sort({ createdAt: -1 })
    ]);

    res.render('admin/dashboard', {
      jobVacancyCount,
      jobSeekerCount,
      tutorCount,
      employers,
      jobSeekers,
      tutors,
      currentDate: new Date().toLocaleDateString()
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Server Error');
  }
});

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

module.exports = router;
