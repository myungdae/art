// router/user.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../model/user');
const JobVacancy = require('../model/jobVacancy');
const OnlineTutor = require('../model/onlineTutor');   // added
const Thread = require('../model/thread');             // added
const { logThread } = require('../utils/threadLog');   // added
const JobSeeker = require('../model/jobSeeker');

const { requireLogin } = require('../middleware/auth');

// ---------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------
router.get('/register', (req, res) => {
  res.render('user/register');
});

router.post('/register', async (req, res) => {
  let { username, email, password, role } = req.body;
  // normalize role values
  if (role === 'JobSeeker' || role === 'Job Seeker') role = 'Job_Seeker';
  else if (role === 'OnlineTutor' || role === 'Online Tutor') role = 'Online_Tutor';

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).send('This email is already registered.');

    const newUser = new User({ username, email, password, role });
    await newUser.save();

    req.session.user = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    };
    res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).send('❌ Registration failed.');
  }
});

// ---------------------------------------------------------------------
// Login / Logout
// ---------------------------------------------------------------------
router.get('/login', (req, res) => {
  res.render('user/login');
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.render('user/login', {
        error: `❌ Email or password incorrect<br>
                New here? <a href="/user/register" style="color:gold;text-decoration:underline;">Register</a> and choose your role.`
      });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    // activity log (non-blocking)
    try {
      await logThread(req, {
        type: 'auth',
        action: 'login',
        source: 'auth',
        sourceId: String(user._id),
        title: 'Login',
        summary: `user=${user.email}`
      });
    } catch (e) {
      console.error('[thread] login log failed:', e.message || e);
    }

    res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).send('❌ Login failed.');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------------------------------------------------------------------
// Mypage router (role switch)
// ---------------------------------------------------------------------
router.get('/mypage', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send('User not found');

    if (user.role === 'Employer') return res.redirect('/user/mypage-employer');
    if (user.role === 'Job_Seeker') return res.redirect('/user/mypage-jobseeker');
    if (user.role === 'Online_Tutor') return res.redirect('/user/mypage-tutor');

    res.send('Unknown role');
  } catch (err) {
    console.error('❌ Failed to load mypage:', err.message);
    res.status(500).send('❌ Error loading My Page');
  }
});

// ---------------------------------------------------------------------
// Employer mypage
// ---------------------------------------------------------------------
router.get('/mypage-employer', requireLogin, async (req, res) => {
  const jobVacancies = await JobVacancy.find({ user: req.session.user._id }).lean();
  const user = await User.findById(req.session.user._id).lean();
  res.render('user/mypage-employer', { user, jobVacancies });
});

// ---------------------------------------------------------------------
// Job Seeker mypage + payments
// ---------------------------------------------------------------------
router.get('/mypage-jobseeker', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();
  let remainingDays = 0;

  if (user.resumeAccess && user.resumeAccess.startDate && user.resumeAccess.durationDays) {
    const start = new Date(user.resumeAccess.startDate);
    const durationMs = user.resumeAccess.durationDays * 86400000;
    const diff = start.getTime() + durationMs - Date.now();
    remainingDays = diff > 0 ? Math.ceil(diff / 86400000) : 0;
  }

  res.render('user/mypage-jobseeker', { user, remainingDays, purchaseLink: '/user/job-seekers/resume-access' });
});

// payments (job seeker)
router.get('/job-seekers/resume-access', requireLogin, (req, res) => {
  res.render('jobSeeker/resumeAccess');
});

router.post('/job-seekers/resume-access', requireLogin, async (req, res) => {
  try {
    console.log('📝 POST body:', req.body);
    const { accessPeriod } = req.body;
    const periodDays = parseInt(accessPeriod);
    console.log('📝 Parsed periodDays:', periodDays);

    if (![30, 90, 365].includes(periodDays)) {
      console.warn('❗ Invalid access period received:', periodDays);
      return res.status(400).send('❌ Invalid access period');
    }

    await User.findByIdAndUpdate(req.session.user._id, {
      resumeAccess: {
        startDate: new Date(),
        durationDays: periodDays
      }
    });

    console.log(`✅ Resume access updated: ${periodDays} days for user ${req.session.user._id}`);
    res.redirect(`/paypal/checkout?accessPeriod=${periodDays}`);
  } catch (err) {
    console.error('❌ Failed to process resume access:', err.message);
    res.status(500).send('❌ Failed to process resume access');
  }
});

// ---------------------------------------------------------------------
// Online Tutor mypage (dashboard)
// - Shows tutor profile matched by logged-in user's email
// - Loads recent activity logs (source: 'online_tutors')
// ---------------------------------------------------------------------
router.get('/mypage-tutor', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    const email = user?.email;

    // find my tutor profile (by email)
    const tutor = email
      ? await OnlineTutor.findOne({ email }).sort({ updatedAt: -1 }).lean()
      : null;

    // recent activity from threads
    let threads = [];
    try {
      threads = await Thread.find({
        userId: String(req.session.user._id),
        source: 'online_tutors'
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    } catch (e) {
      console.error('[thread] list failed:', e.message || e);
    }

    res.render('user/mypage-tutor', { user, tutor, threads });
  } catch (err) {
    console.error('❌ Tutor mypage error:', err.message);
    res.status(500).send('❌ Failed to load Tutor Dashboard');
  }
});

module.exports = router;
