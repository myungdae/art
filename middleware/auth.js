const mongoose = require('mongoose');

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const userSession = req.session.user;
  const _id = userSession._id || userSession.id;

  req.user = {
    ...userSession,
    _id: _id ? new mongoose.Types.ObjectId(_id) : undefined
  };

  next();
}


module.exports = { requireLogin };
