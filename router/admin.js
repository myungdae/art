const express = require('express');
const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');

// ✅ 모델 불러오기
const JobVacancy = require('../model/jobVacancy');
const JobSeeker = require('../model/jobSeeker');
const Tutor = require('../model/tutor');

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

// ✅ 관리자 대시보드
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [jobVacancyCount, jobSeekerCount, tutorCount] = await Promise.all([
      JobVacancy.countDocuments(),
      JobSeeker.countDocuments(),
      Tutor.countDocuments()
    ]);

    const jobVacancies = await JobVacancy.find(); // ✅ remainingTokens 기준 데이터 출력용
    const jobSeekers = await JobSeeker.find().sort({ createdAt: -1 });
    const tutors = await Tutor.find().sort({ createdAt: -1 });

    res.render('admin/dashboard', {
      jobVacancyCount,
      jobSeekerCount,
      tutorCount,
      jobVacancies,   // ✅ name, email, remainingTokens, datePosted 등 dashboard.pug에서 사용 가능
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
