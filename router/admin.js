const express = require('express');
const router = express.Router();

const User = require('../model/user');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');
const requireAdmin = require('../middleware/requireAdmin');

// ✅ 관리자 로그인
router.get('/login', (req, res) => {
  res.render('admin/login');
});

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

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// ✅ 관리자 대시보드
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // Employers: adsAvailable > 0 인 paid user
    const employers = await User.find({
      role: 'Employer',
      adsAvailable: { $gt: 0 }
    }).sort({ createdAt: -1 });

    // Job Seekers: resumeAccess 있고 Remaining Days > 0
    const jobSeekersRaw = await JobSeeker.find().sort({ createdAt: -1 });
    const jobSeekers = jobSeekersRaw.filter(js => {
      if (!js.resumeAccess) return false;
      const startDate = js.resumeAccess.startDate ? new Date(js.resumeAccess.startDate) : null;
      const durationDays = js.resumeAccess.durationDays || 0;
      if (!startDate || durationDays === 0) return false;
      const now = new Date();
      const diff = (startDate.getTime() + durationDays * 86400000 - now.getTime()) / 86400000;
      return diff > 0;
    });

    // Online Tutors: resumeAccess 있고 Remaining Days > 0
    const onlineTutorsRaw = await OnlineTutor.find().sort({ createdAt: -1 });
    const onlineTutors = onlineTutorsRaw.filter(ot => {
      if (!ot.resumeAccess) return false;
      const startDate = ot.resumeAccess.startDate ? new Date(ot.resumeAccess.startDate) : null;
      const durationDays = ot.resumeAccess.durationDays || 0;
      if (!startDate || durationDays === 0) return false;
      const now = new Date();
      const diff = (startDate.getTime() + durationDays * 86400000 - now.getTime()) / 86400000;
      return diff > 0;
    });

    res.render('admin/dashboard', {
      employers,
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
