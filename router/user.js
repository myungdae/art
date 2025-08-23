// router/user.js
'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../model/user');
const JobVacancy = require('../model/jobVacancy');
const OnlineTutor = require('../model/onlineTutor');
const Thread = require('../model/thread');
const JobSeeker = require('../model/jobSeeker');

const methodOverride = require('method-override');
const requireAdmin = require('../middleware/requireAdmin');
const { requireLogin, requireRole /*, requirePaidEmployer*/ } = require('../middleware/auth');

router.use(methodOverride('_method'));

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

    // 선택: 로그인 로깅 (실패해도 무시)
    try {
      const { logThread } = require('../utils/threadLog');
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

/* --------------------------- Employer mypage (credits-based posting) --------------------------- */
router.get('/mypage-employer',
  requireLogin,
  requireRole('Employer'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.session.user._id).lean();
      if (!user) return res.status(404).send('User not found');

      // 내 공고 목록
      const jobVacancies = await JobVacancy.find({ user: req.session.user._id }).lean();

      // (참고용) 활성 공고 수 / 총 슬롯
      const now = new Date();
      const TOTAL_SLOTS = parseInt(process.env.JOB_POST_QUOTA ?? '16', 10);

      const idOrEmail = user.email
        ? [{ user: user._id }, { email: user.email }]
        : [{ user: user._id }];

      const activeQuery = {
        $and: [
          { $or: idOrEmail },
          { $or: [ { expiresAt: { $gte: now } }, { expiresAt: { $exists: false } } ] }
        ]
      };

      const activeJobs = await JobVacancy.countDocuments(activeQuery);
      const remainingSlots = Math.max(0, TOTAL_SLOTS - activeJobs);

      // ✅ 핵심: 포스팅 가능 여부는 adsAvailable(보유 크레딧)로 판단
      const adCredits = Number(user.adsAvailable || 0);
      const canPost = adCredits > 0;

      // 가장 빨리 만료되는 공고(표시용)
      const soonest = await JobVacancy.findOne({
        $or: idOrEmail,
        expiresAt: { $exists: true }
      }).sort({ expiresAt: 1 }).select('expiresAt title').lean();

      let nextExpireAt = null;
      let nextExpireTitle = null;
      let expireTag = null;

      if (soonest && soonest.expiresAt) {
        const expireDate = new Date(soonest.expiresAt);
        const msDiff = expireDate.getTime() - now.getTime();
        if (msDiff <= 0) expireTag = 'Expired';
        else {
          const daysLeft = Math.ceil(msDiff / 86400000);
          expireTag = daysLeft === 0 ? 'Today' : `D-${daysLeft}`;
        }
        const kst = new Date(expireDate.getTime() + 9 * 60 * 60 * 1000);
        nextExpireAt = kst.toISOString().slice(0, 10);
        nextExpireTitle = soonest.title || null;
      }

      return res.render('user/mypage-employer', {
        user,
        jobVacancies,

        totalSlots: TOTAL_SLOTS,
        activeJobs,
        remainingSlots,

        // 👇 새로 추가: 크레딧/버튼 노출 제어
        adCredits,
        canPost,

        nextExpireAt,
        nextExpireTitle,
        expireTag
      });
    } catch (err) {
      console.error('Employer mypage error:', err.message);
      return next(err);
    }
  }
);

/* --------------------------- Employer plan (선택: 그대로 유지) --------------------------- */
router.get('/employer/plan',
  requireLogin,
  requireRole('Employer'),
  (req, res) => res.render('employer/plan')
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
      return res.redirect(`/paypal/checkout?type=employer&employerPeriod=${periodDays}`);
    } catch (err) {
      console.error('❌ Employer plan error:', err.message);
      return res.status(500).send('❌ Failed to process employer plan');
    }
  }
);

/* --------------------------- Job Seeker mypage + payments --------------------------- */
function calcRemainingDays(resumeAccess) {
  if (!resumeAccess || !resumeAccess.startDate || !resumeAccess.durationDays) return 0;
  const start = new Date(resumeAccess.startDate);
  const durationMs = resumeAccess.durationDays * 86400000;
  const diff = start.getTime() + durationMs - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

router.get('/mypage-jobseeker', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();

  const remainingDays = calcRemainingDays(user?.resumeAccess);
  const hasActiveResumeAccess = remainingDays > 0;

  return res.render('user/mypage-jobseeker', {
    user,
    remainingDays,
    hasActiveResumeAccess,
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

    // 결제 페이지로 이동 (레거시 경로 유지)
    return res.redirect(`/paypal/checkout?accessPeriod=${periodDays}`);
  } catch (err) {
    console.error('❌ Failed to process resume access:', err.message);
    return res.status(500).send('❌ Failed to process resume access');
  }
});

/* --------------------------- Tutor mypage --------------------------- */
router.get('/mypage-tutor', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send('User not found');

    const email = user.email || '';
    const tutor = email
      ? await OnlineTutor.findOne({ email }).sort({ updatedAt: -1 }).lean()
      : null;

    const threads = await Thread.find({
      userId: String(req.session.user._id),
      source: 'online_tutors'
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .catch(() => []);

    const data = { user, tutor, tutorDoc: tutor, threads };

    // ✅ 폴백 제거: 오직 'user/mypage-tutor' 만 렌더
    return res.render('user/mypage-tutor', data);
  } catch (err) {
    console.error('❌ Tutor mypage error:', err.stack || err);
    return res.status(500).send('❌ Failed to load Tutor Dashboard');
  }
});

/* --------------------------- Tutor visibility purchase (GET/POST) --------------------------- */
// 버튼에서 바로 결제로 가는 엔트리
router.get('/online-tutors/visibility/start', requireLogin, (req, res) => {
  const days = parseInt(req.query.days, 10);
  if (![30, 90, 365].includes(days)) {
    return res.status(400).send('❌ Invalid tutor visibility period');
  }
  return res.redirect(`/paypal/checkout?type=tutor&accessPeriod=${days}`);
});

// 설명/선택 페이지 (필요 시)
router.get('/online-tutors/visibility', requireLogin, (req, res) => {
  return res.render('onlineTutor/visibility', {
    user: req.session.user,
    pageTitle: 'Purchase Tutor Visibility'
  });
});

router.post('/online-tutors/visibility', requireLogin, async (req, res) => {
  try {
    const { accessPeriod } = req.body; // 30 | 90 | 365
    const days = parseInt(accessPeriod, 10);
    if (![30, 90, 365].includes(days)) {
      return res.status(400).send('❌ Invalid tutor visibility period');
    }
    return res.redirect(`/paypal/checkout?type=tutor&accessPeriod=${days}`);
  } catch (e) {
    console.error('[tutor visibility] error:', e.message || e);
    return res.status(500).send('❌ Failed to process tutor visibility');
  }
});

// (선택) 구경로 별칭
router.get('/tutor/plan', (req, res) => res.redirect('/user/online-tutors/visibility'));

module.exports = router;
