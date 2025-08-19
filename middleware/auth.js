// middleware/auth.js
const mongoose = require('mongoose');

/** 로그인 여부 체크 (기존 그대로) */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    // 로그인 후 돌아올 경로 저장
    if (req.originalUrl) req.session.returnTo = req.originalUrl;
    return res.redirect('/login'); // 프로젝트가 /user/login 이면 여기만 '/user/login' 으로 교체
  }

  const userSession = req.session.user;
  const _id = userSession._id || userSession.id;

  req.user = {
    ...userSession,
    _id: _id ? new mongoose.Types.ObjectId(_id) : undefined
  };

  next();
}

/** 역할(롤) 체크: 'Employer' | 'Job_Seeker' | 'Admin' 등 */
function requireRole(role) {
  return (req, res, next) => {
    const u = req.user || req.session?.user;
    if (!u || u.role !== role) {
      return res.status(403).send('Forbidden: insufficient role');
    }
    next();
  };
}

/** Employer 유료 결제 여부 체크 */
function requirePaidEmployer(req, res, next) {
  const u = req.user || req.session?.user;
  if (!u) return res.redirect('/login');

  // 결제 플래그/기간 중 하나만 있어도 통과하도록 유연하게 체크
  const isBoolPaid = !!u.isPaidEmployer; // Boolean 플래그 사용 시
  const byDatePaid =
    u.paidUntil && new Date(u.paidUntil).getTime() > Date.now(); // 기간형 사용 시

  if (isBoolPaid || byDatePaid) return next();

  // 미결제: 결제 페이지로 유도 (필요 시 경로 조정)
  if (req.originalUrl) req.session.returnTo = req.originalUrl;
  return res.redirect('/payment/employer');
}

module.exports = {
  requireLogin,
  requireRole,
  requirePaidEmployer,
};
