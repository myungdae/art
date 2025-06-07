const express = require('express');
const router = express.Router();
const User = require('../model/user'); // Mongoose 모델 불러오기

// ✅ 회원가입 폼 보여주기
router.get('/register', (req, res) => {
  res.render('user/register');
});

// ✅ 회원가입 정보 처리 (POST)
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    // 사용자 생성
    const newUser = new User({
      username,
      email,
      password,
      role
    });

    await newUser.save();

    console.log('✅  Registration successful:', newUser);
    res.send('Your registration has been completed successfully!');
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).send('Registration failed due to a server error.');
  }
});

// ✅ 로그인 폼 보여주기
router.get('/login', (req, res) => {
  res.render('user/login');
});

// ✅ 로그인 처리
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).send('Invalid email or password.');
    }
    res.send('Login successful!');
  } catch (err) {
    console.error('❌ 로그인 오류:', err.message);
    res.status(500).send('Internal server error.');
  }
});


module.exports = router;
