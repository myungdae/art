const express = require('express');
const router = express.Router();
const User = require('../model/user');
const JobVacancy = require('../model/jobVacancy'); 

const auth = require('../middleware/auth');
const requireLogin = auth.requireLogin;

console.log("✅ typeof requireLogin:", typeof requireLogin);


// Register form
router.get('/register', (req, res) => {
  res.render('user/register');
});

// Register handler
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send('This email is already registered.');
    }

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

// Login form
router.get('/login', (req, res) => {
  res.render('user/login');
});

// Login handler
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

router.get('/mypage', requireLogin, async (req, res) => {
  if (req.user.role === 'Employer') {
    const myAdsCount = await JobVacancy.countDocuments({ user: req.user._id });
    res.render('user/mypage', {
      user: req.user,
      myAdsCount
    });
  } else {
    res.render('user/mypage', { user: req.user, myAdsCount: 0 });
  }
});


// Session check
router.get('/test-session', (req, res) => {
  if (req.session.user) {
    res.send(`✅ Session active: ${req.session.user.username}`);
  } else {
    res.send('❌ No session found');
  }
});

// ✅ Logout

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/'); // 홈으로 리디렉션
  });
});

module.exports = router;
