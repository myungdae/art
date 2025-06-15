const express = require('express');
const router = express.Router();
const User = require('../model/user');
const JobVacancy = require('../model/jobVacancy');
const { requireLogin } = require('../middleware/auth');

// ✅ 회원가입 폼
router.get('/register', (req, res) => {
  res.render('user/register');
});

// ✅ 회원가입 처리
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).send('This email is already registered.');

    const newUser = new User({ username, email, password, role });
    await newUser.save();

    console.log('✅ Registration successful:', newUser);
    res.send('✅ Registration completed successfully.');
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).send('This email is already registered. (MongoDB)');
    }
    console.error('❌ Registration error:', err.message);
    res.status(500).send('❌ Registration failed due to a server error.');
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
      return res.status(401).send('❌ Invalid email or password.');
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    console.log('✅ Login successful. Session saved:', req.session.user);
    res.redirect('/user/mypage');
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).send('❌ Login failed due to a server error.');
  }
});

// ✅ 마이페이지
router.get('/mypage', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const ads = await JobVacancy.find({ user: user._id }).sort({ createdAt: -1 }); // 최신순

    res.render('user/mypage', {
      user,
      adsRemaining: user.adsAvailable || 0,
      ads
    });
  } catch (err) {
    console.error('❌ Failed to load mypage:', err.message);
    res.status(500).send('❌ Error loading my page');
  }
});

// ✅ 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
