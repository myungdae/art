const express = require('express');
const router = express.Router();

const JobVacancy = require('../model/jobVacancy');
const JobSeeker = require('../model/jobSeeker'); // 반드시 존재해야 함
const Tutor = require('../model/tutor');         // 반드시 존재해야 함

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

// ✅ 관리자 대시보드 (통계 포함)
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [jobVacancyCount, jobSeekerCount, tutorCount] = await Promise.all([
      JobVacancy.countDocuments(),
      JobSeeker.countDocuments(),
      Tutor.countDocuments()
    ]);

    res.render('admin/dashboard', {
      jobVacancyCount,
      jobSeekerCount,
      tutorCount,
      currentDate: new Date().toLocaleDateString()
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');
  });
});

// ✅ 공고 삭제
router.post('/delete/:id', requireAdmin, async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/admin/dashboard');
});

module.exports = router;
