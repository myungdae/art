// middleware/auth.js
"use strict";

const mongoose = require("mongoose");

/** 로그인 여부 체크 */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.originalUrl) req.session.returnTo = req.originalUrl;
    return res.redirect("/user/login"); // 통일
  }

  const userSession = req.session.user;
  const _id = userSession._id || userSession.id;

  // downstream에서 편하게 쓰도록 req.user 세팅
  req.user = {
    ...userSession,
    _id: _id ? new mongoose.Types.ObjectId(_id) : undefined,
  };

  next();
}

/** 역할 문자열을 표준화 (소문자+언더스코어) 하고 별칭을 통일 */
function canonRole(role) {
  const key = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_"); // "Online Tutor" -> "online_tutor"

  // 별칭/오타 흡수: 튜터/잡시커 표기 다양성 정리
  const map = {
    // 온라인 튜터
    online_tutor: "online_tutor",
    onlinetutor: "online_tutor",
    tutor: "online_tutor",

    // 잡시커
    job_seeker: "job_seeker",
    jobseeker: "job_seeker",
    "job seeker": "job_seeker", // (안 들어오지만 안전망)

    // 그 외
    employer: "employer",
    admin: "admin",
  };

  return map[key] || key;
}

/**
 * 역할(롤) 체크
 * - 단일 문자열 또는 문자열 배열을 허용
 * - 별칭/공백/케이스/대시 차이 자동 흡수
 *
 * 예)
 *   requireRole('Employer')
 *   requireRole(['Online_Tutor', 'Tutor'])     // 과거 'Tutor' 계정 호환
 *   requireRole(['Job_Seeker', 'Job Seeker'])  // 표기 혼용 호환
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const allowedCanon = new Set(allowed.map(canonRole));

  return (req, res, next) => {
    const u = req.user || req.session?.user;
    if (!u) return res.redirect("/user/login");

    const userCanon = canonRole(u.role);
    if (!allowedCanon.has(userCanon)) {
      return res.status(403).send("Forbidden: insufficient role");
    }
    next();
  };
}

/** Employer 유료 결제 여부 체크 (기존 로직 유지) */
function requirePaidEmployer(req, res, next) {
  const u = req.user || req.session?.user;
  if (!u) return res.redirect("/user/login");

  const isBoolPaid = !!u.isPaidEmployer;
  const byDatePaid =
    u.paidUntil && new Date(u.paidUntil).getTime() > Date.now();

  if (isBoolPaid || byDatePaid) return next();

  if (req.originalUrl) req.session.returnTo = req.originalUrl;
  return res.redirect("/payment/employer");
}

module.exports = {
  requireLogin,
  requireRole,
  requirePaidEmployer,
};
