const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const requireAdmin = require('../middleware/requireAdmin');

// ✅ 로그인 페이지
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
  const jobs = await JobVacancy.find();
  res.render('admin/dashboard', { jobs });
});

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');  // 또는 홈으로 보내려면 '/'로 수정 가능
  });
});

// ✅ 삭제
router.post('/delete/:id', requireAdmin, async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/admin/dashboard');
});

module.exports = router;
