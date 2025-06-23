// ~/esl/middleware/requireEmployer.js

function requireEmployer(req, res, next) {
  if (req.user && req.user.role === 'Employer') {
    return next();
  } else {
    console.warn('❌ 접근 거부: Employer 권한 필요');
    return res.redirect('/login');
  }
}

module.exports = { requireEmployer }; // ✅ 반드시 구조분해에 맞게
