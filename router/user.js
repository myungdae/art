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

// ✅ 회원가입 처리 + 자동 로그인
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).send('This email is already registered.');

    const newUser = new User({ username, email, password, role });
    await newUser.save();

    console.log('✅ Registration successful:', newUser);

    req.session.user = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    };

    return res.redirect('/user/mypage');
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).send('This email is already registered.');
    }
    console.error('❌ Registration error:', err.message);
    res.status(500).send('❌ Registration failed.');
  }
});

// ✅ 로그인 폼
router.get('/login', (req, res) => {
  res.render('user/login');
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
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    console.log('✅ Login successful:', req.session.user);
    res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).send('❌ Login failed.');
  }
});

// ✅ 마이페이지 (adsAvailable을 항상 최신 DB값으로 반영)
router.get('/mypage', requireLogin, async (req, res) => {
  try {
    const ObjectId = mongoose.Types.ObjectId;
    const userId = ObjectId.isValid(req.session.user.id)
      ? new ObjectId(req.session.user.id)
      : req.session.user.id;

    // ✅ 세션이 아니라 실제 DB에서 최신 사용자 정보 가져오기
    const fullUser = await User.findById(userId).lean();

    const jobVacancies = await JobVacancy.find({ user: userId }).lean();

    res.render('user/mypage', {
      user: fullUser,       // ✅ 최신 adsAvailable 반영
      jobVacancies
    });
  } catch (err) {
    console.error('❌ Failed to load mypage:', err.message);
    res.status(500).send('❌ Error loading My Page');
  }
});

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
