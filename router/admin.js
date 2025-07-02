const express = require('express');
const router = express.Router();

const User = require('../model/user');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');
const requireAdmin = require('../middleware/requireAdmin');

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

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    const employers = await User.find({
      role: 'Employer',
      adsAvailable: { $gt: 0 }
    }).sort({ createdAt: -1 });
    console.log("✅ Employers found:", employers.length);

    const jobSeekersRaw = await JobSeeker.find().sort({ createdAt: -1 });
    console.log("✅ JobSeekers raw count:", jobSeekersRaw.length);
    const jobSeekers = jobSeekersRaw.map(js => {
      console.log("🔍 JobSeeker debug:", js.name, js.resumeAccess);
      return { ...js.toObject(), remainingDays: 1 };
    });

    const onlineTutorsRaw = await OnlineTutor.find().sort({ createdAt: -1 });
    console.log("✅ OnlineTutors raw count:", onlineTutorsRaw.length);
    const onlineTutors = onlineTutorsRaw.map(ot => {
      console.log("🔍 OnlineTutor debug:", ot.username || ot.name, ot.resumeAccess);
      return { ...ot.toObject(), remainingDays: 1 };
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
