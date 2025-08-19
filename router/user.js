// router/user.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../model/user');
const JobVacancy = require('../model/jobVacancy');
const OnlineTutor = require('../model/onlineTutor');
const Thread = require('../model/thread');
const { logThread } = require('../utils/threadLog');
const JobSeeker = require('../model/jobSeeker');

const { requireLogin, requireRole, requirePaidEmployer } = require('../middleware/auth');

/* --------------------------- Register --------------------------- */
router.get('/register', (req, res) => {
  res.render('user/register');
});

router.post('/register', async (req, res) => {
  let { username, email, password, role } = req.body;

  // normalize role
  if (role === 'JobSeeker' || role === 'Job Seeker') role = 'Job_Seeker';
  else if (role === 'OnlineTutor' || role === 'Online Tutor') role = 'Online_Tutor';
  // Employer는 그대로 사용

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
    return res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    return res.status(500).send('❌ Registration failed.');
  }
});

/* --------------------------- Login / Logout --------------------------- */
router.get('/login', (req, res) => res.render('user/login'));

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

    // async log
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

    return res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Login error:', err.message);
    return res.status(500).send('❌ Login failed.');
  }
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

/* --------------------------- Mypage switch --------------------------- */
router.get('/mypage', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send('User not found');

    if (user.role === 'Employer')     return res.redirect('/user/mypage-employer');
    if (user.role === 'Job_Seeker')   return res.redirect('/user/mypage-jobseeker');
    if (user.role === 'Online_Tutor') return res.redirect('/user/mypage-tutor');

    return res.send('Unknown role');
  } catch (err) {
    console.error('❌ Failed to load mypage:', err.message);
    return res.status(500).send('❌ Error loading My Page');
  }
});

/* --------------------------- Employer mypage (with payment branch) --------------------------- */
router.get('/mypage-employer',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    const user = await User.findById(req.session.user._id).lean();

    // 결제 여부(둘 중 하나라도 true면 OK)
    const isPaidFlag  = !!user?.isPaidEmployer;
    const isPaidByDate = user?.paidUntil && new Date(user.paidUntil).getTime() > Date.now();
    const paid = isPaidFlag || isPaidByDate;

    // 남은 일수
    let employerDaysLeft = 0;
    if (user?.paidUntil) {
      const diff = new Date(user.paidUntil).getTime() - Date.now();
      employerDaysLeft = diff > 0 ? Math.ceil(diff / 86400000) : 0;
    }

    const jobVacancies = await JobVacancy.find({ user: req.session.user._id }).lean();

    // 뷰에서 사용할 결제링크
    const purchaseLink = '/user/employer/plan';

    // (선택) 디버그
    // console.log('[mypage-employer]', { paid, employerDaysLeft });

    return res.render('user/mypage-employer', {
      user,
      jobVacancies,
      paid,
      employerDaysLeft,
      purchaseLink
    });
  }
);

/* --------------------------- Employer plan (purchase entry) --------------------------- */
router.get('/employer/plan',
  requireLogin,
  requireRole('Employer'),
  (req, res) => {
    // 플랜 선택 화면 (30/90/365)
    return res.render('employer/plan');
  }
);

router.post('/employer/plan',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    try {
      const { employerPeriod } = req.body; // 30 | 90 | 365
      const periodDays = parseInt(employerPeriod, 10);
      if (![30, 90, 365].includes(periodDays)) {
        return res.status(400).send('❌ Invalid employer plan period');
      }
      // 결제 라우트로 넘길 때 구분자 포함
      return res.redirect(`/paypal/checkout?type=employer&employerPeriod=${periodDays}`);
    } catch (err) {
      console.error('❌ Employer plan error:', err.message);
      return res.status(500).send('❌ Failed to process employer plan');
    }
  }
);

/* --------------------------- Job Seeker mypage + payments --------------------------- */
router.get('/mypage-jobseeker', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();
  let remainingDays = 0;

  if (user.resumeAccess && user.resumeAccess.startDate && user.resumeAccess.durationDays) {
    const start = new Date(user.resumeAccess.startDate);
    const durationMs = user.resumeAccess.durationDays * 86400000;
    const diff = start.getTime() + durationMs - Date.now();
    remainingDays = diff > 0 ? Math.ceil(diff / 86400000) : 0;
  }

  return res.render('user/mypage-jobseeker', {
    user,
    remainingDays,
    purchaseLink: '/user/job-seekers/resume-access'
  });
});

router.get('/job-seekers/resume-access', requireLogin, (req, res) => {
  return res.render('jobSeeker/resumeAccess');
});

router.post('/job-seekers/resume-access', requireLogin, async (req, res) => {
  try {
    const { accessPeriod } = req.body;
    const periodDays = parseInt(accessPeriod, 10);

    if (![30, 90, 365].includes(periodDays)) {
      return res.status(400).send('❌ Invalid access period');
    }

    await User.findByIdAndUpdate(req.session.user._id, {
      resumeAccess: {
        startDate: new Date(),
        durationDays: periodDays
      }
    });

    return res.redirect(`/paypal/checkout?accessPeriod=${periodDays}`);
  } catch (err) {
    console.error('❌ Failed to process resume access:', err.message);
    return res.status(500).send('❌ Failed to process resume access');
  }
});

/* --------------------------- Online Tutor mypage --------------------------- */
router.get('/mypage-tutor', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    const email = user?.email;

    const tutor = email
      ? await OnlineTutor.findOne({ email }).sort({ updatedAt: -1 }).lean()
      : null;

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

    return res.render('user/mypage-tutor', { user, tutor, threads });
  } catch (err) {
    console.error('❌ Tutor mypage error:', err.message);
    return res.status(500).send('❌ Failed to load Tutor Dashboard');
  }
});

module.exports = router;
