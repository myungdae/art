// middleware/requireAdCredit.js
const User = require('../model/user');

module.exports = async function requireAdCredit(req, res, next) {
  if (!req.session?.user?._id) {
    req.flash?.('error', 'Please log in first.');
    return res.redirect('/user/login');
  }

  const u = await User.findById(req.session.user._id).lean();
  const credits = Number(u?.adsAvailable || 0);

  if (credits <= 0) {
    req.flash?.('error', 'You need ad credits to post a job vacancy.');
    return res.redirect('/paypal/checkout'); // 결제 페이지로 유도
  }

  next();
};
