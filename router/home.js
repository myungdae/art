const express = require('express');
const router = express.Router();

// GET /
router.get('/', (req, res) => {
  res.render('home/index', { user: req.user });
});

module.exports = router;
