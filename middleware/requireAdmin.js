// middleware/requireAdmin.js
module.exports = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};
