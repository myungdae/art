const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../model/user');
const JobVacancy = require('../model/jobVacancy');
const { requireLogin } = require('../middleware/auth');

// ✅ 회원가입 폼
router.get('/register', (req, res) => {
  res.render('user/register');
});

// ✅ 회원가입 처리
router.post('/register', async (req, res) => {
  let { username, email, password, role } = req.body;

  // 역할 표준화
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

// ✅ 로그인 폼
router.get('/login', (req, res) => {
  res.render('user/login');
});

router.post('/job-seekers/resume-access', requireLogin, (req, res) => {
  console.log('✅ Resume Access POST hit:', req.body);
  // 여기에 PayPal 처리나 DB update 로직 추가
  res.send(`Received POST for resume access: ${req.body.accessPeriod}`);
});


// ✅ 로그인 처리
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
    res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).send('❌ Login failed.');
  }
});

// ✅ 마이페이지: 역할별 분기
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

// ✅ Employer 전용 마이페이지
router.get('/mypage-employer', requireLogin, async (req, res) => {
  const jobVacancies = await JobVacancy.find({ user: req.session.user._id }).lean();
  const user = await User.findById(req.session.user._id).lean();
  res.render('user/mypage-employer', { user, jobVacancies });
});

// ✅ Job Seeker 전용 마이페이지
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

// ✅ Job Seeker 결제 화면
router.get('/job-seekers/resume-access', requireLogin, (req, res) => {
  res.render('jobSeeker/resumeAccess');
});

// ✅ Online Tutor 전용 마이페이지
router.get('/mypage-tutor', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();
  res.render('user/mypage-tutor', { user });
});

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
