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
    console.log(`🌍 NOW (server time): ${now.toISOString()}`);

    // ✅ Employers
    const employers = await User.find({
      role: 'Employer',
      adsAvailable: { $gt: 0 }
    }).sort({ createdAt: -1 });
    console.log("✅ Employers found:", employers.length);

    // ✅ Job Seekers
    const jobSeekersRaw = await JobSeeker.find().sort({ createdAt: -1 });
    console.log("✅ JobSeekers raw count:", jobSeekersRaw.length);

    const jobSeekers = jobSeekersRaw.map(js => {
      let remainingDays = 0;
      if (js.resumeAccess && js.resumeAccess.startDate && js.resumeAccess.durationDays) {
        const startDate = new Date(js.resumeAccess.startDate);
        const endDate = new Date(startDate.getTime() + js.resumeAccess.durationDays * 86400000);
        remainingDays = Math.max(0, Math.ceil((endDate - now) / 86400000));

        console.log(`🔍 JobSeeker ${js.email} → start: ${startDate.toISOString()}, end: ${endDate.toISOString()}, remainingDays: ${remainingDays}`);
      } else {
        console.log(`⚠️ JobSeeker ${js.email}: no valid resumeAccess`);
      }

      return {
        username: js.name || js.username || 'N/A',
        email: js.email || 'N/A',
        remainingDays,
        createdAt: js.createdAt ? js.createdAt.toISOString().split('T')[0] : 'N/A'
      };
    });

    // ✅ Online Tutors
    const onlineTutorsRaw = await OnlineTutor.find().sort({ createdAt: -1 });
    console.log("✅ OnlineTutors raw count:", onlineTutorsRaw.length);

    const onlineTutors = onlineTutorsRaw.map(ot => {
      let remainingDays = 0;
      if (ot.resumeAccess && ot.resumeAccess.startDate && ot.resumeAccess.durationDays) {
        const startDate = new Date(ot.resumeAccess.startDate);
        const endDate = new Date(startDate.getTime() + ot.resumeAccess.durationDays * 86400000);
        remainingDays = Math.max(0, Math.ceil((endDate - now) / 86400000));

        console.log(`🔍 OnlineTutor ${ot.email} → start: ${startDate.toISOString()}, end: ${endDate.toISOString()}, remainingDays: ${remainingDays}`);
      } else {
        console.log(`⚠️ OnlineTutor ${ot.email || ot.username}: no valid resumeAccess`);
      }

      return {
        username: ot.username || ot.name || 'N/A',
        email: ot.email || 'N/A',
        remainingDays,
        createdAt: ot.createdAt ? ot.createdAt.toISOString().split('T')[0] : 'N/A'
      };
    });

    console.log("✅ Render data:", {
      employers: employers.length,
      jobSeekers: jobSeekers.length,
      onlineTutors: onlineTutors.length
    });

    res.render('admin/dashboard', {
      employers: employers || [],
      jobSeekers: jobSeekers || [],
      onlineTutors: onlineTutors || []
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
