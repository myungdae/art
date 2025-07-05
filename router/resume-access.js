const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');

// ✅ Resume Access Confirm Page
router.get('/confirm', requireLogin, (req, res) => {
  res.render('resume/confirm', { user: req.user });
});

module.exports = router;
