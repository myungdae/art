// middleware/requireEmployer.js

module.exports = function (req, res, next) {
  if (!req.session.user || req.session.user.role !== 'Employer') {
    return res.status(403).render('error', {
      message: "🚫 Only employers can access this page.",
      error: {}
    });
  }
  next();
};

