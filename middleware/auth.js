const mongoose = require('mongoose');

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  // ✅ 세션에서 user 복구 + _id 필드 강제 설정
  req.user = {
    ...req.session.user,
    _id: req.session.user._id || req.session.user.id
      ? new mongoose.Types.ObjectId(req.session.user._id || req.session.user.id)
      : undefined
  };

  next();
}

module.exports = { requireLogin };
