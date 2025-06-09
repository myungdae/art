const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const requireAdmin = require('../middleware/requireAdmin');


router.get('/login', (req, res) => {
  res.render('admin/login');  // ✅ login.pug 불러오기
});

// ✅ 관리자 대시보드
router.get('/dashboard', requireAdmin, async (req, res) => {
  const jobs = await JobVacancy.find();
  res.render('admin/dashboard', { jobs });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // .env에 있는 관리자 계정 정보
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (email === adminEmail && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  } else {
    return res.render('admin/login', { error: 'Invalid email or password.' });
  }
});

// ✅ 삭제
router.post('/delete/:id', requireAdmin, async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/admin/dashboard');
});

module.exports = router;
