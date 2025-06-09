const express = require('express');
const router = express.Router();
require('dotenv').config();

router.get('/login', (req, res) => {
  res.render('admin/login');
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  } else {
    return res.send('Invalid credentials');
  }
});

router.get('/dashboard', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Access Denied');
  res.send('Welcome to Admin Dashboard');
});

module.exports = router;
