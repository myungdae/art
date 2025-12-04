// middleware/requireAdmin.js
module.exports = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    // Check if this is an API request (wants JSON)
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/admin/delete-')) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - Admin access required'
      });
    }
    // Otherwise redirect to login page
    res.redirect('/admin/login');
  }
};
