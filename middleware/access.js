// middleware/access.js
// 결제/가시성(Visibility) 유효성 검사 미들웨어
// - Resume(구직자): 신형 user.isPaidUser + user.resumeVisibilityExpiresAt
//                    구형 user.resumeAccess { startDate, durationDays }
// - Tutor(튜터):     신형 user.isPaidUser + user.tutorVisibilityExpiresAt
//                    구형 user.tutorAccess  { startDate, durationDays }
// 두 체계를 모두 지원하여 하위호환 유지

/* ================= Resume(구직자) ================= */

function isActiveByFlag(user) {
  const paidFlag = !!user.isPaidUser;
  const expiresAtFlag = user.resumeVisibilityExpiresAt
    ? new Date(user.resumeVisibilityExpiresAt)
    : null;
  if (!paidFlag || !expiresAtFlag) return false;
  return expiresAtFlag.getTime() > Date.now();
}

function isActiveByAccess(user) {
  const ra = user.resumeAccess;
  if (!ra || !ra.startDate || !ra.durationDays) return false;
  const start = new Date(ra.startDate);
  const endMs = start.getTime() + (Number(ra.durationDays) || 0) * 86400000;
  return endMs > Date.now();
}

module.exports.requireActiveResumeAccess = async (req, res, next) => {
  const u = req.user;

  // 로그인 안 된 경우
  if (!u) {
    req.flash?.("error", "Please log in first.");
    return res.redirect("/user/login");
  }

  // 데이터베이스에서 최신 user 정보 가져오기 (결제 후 세션 불일치 방지)
  try {
    const User = require("../model/user");
    const dbUser = await User.findById(u._id).lean();
    
    if (!dbUser) {
      req.flash?.("error", "User not found.");
      return res.redirect("/user/login");
    }

    // 유효성 판단 (신형/구형 둘 중 하나라도 통과하면 OK)
    const hasActiveResumeAccess = isActiveByFlag(dbUser) || isActiveByAccess(dbUser);

    if (!hasActiveResumeAccess) {
      // 미결제/만기 → 결제/갱신 페이지로 유도
      req.flash?.(
        "error",
        "Please purchase or renew Resume Visibility before registering your resume."
      );
      return res.redirect("/user/job-seekers/resume-access"); // 현재 프로젝트의 실제 경로
    }

    return next();
  } catch (err) {
    console.error("requireActiveResumeAccess error:", err);
    return res.status(500).send("Error checking resume access");
  }
};

/* ================= Tutor(튜터) ================= */

// 신형: isPaidUser + tutorVisibilityExpiresAt
function isTutorActiveByFlag(user) {
  const paidFlag = !!user.isPaidUser; // 전역 결제 플래그(프로젝트 정책에 따라 별도일 수도 있음)
  const expiresAt = user.tutorVisibilityExpiresAt
    ? new Date(user.tutorVisibilityExpiresAt)
    : null;
  if (!paidFlag || !expiresAt) return false;
  return expiresAt.getTime() > Date.now();
}

// 구형: tutorAccess { startDate, durationDays }
function isTutorActiveByAccess(user) {
  const ta = user.tutorAccess;
  if (!ta || !ta.startDate || !ta.durationDays) return false;
  const start = new Date(ta.startDate);
  const endMs = start.getTime() + (Number(ta.durationDays) || 0) * 86400000;
  return endMs > Date.now();
}

module.exports.requireActiveTutorAccess = async (req, res, next) => {
  const u = req.user;

  if (!u) {
    req.flash?.("error", "Please log in first.");
    return res.redirect("/user/login");
  }

  // 데이터베이스에서 최신 user 정보 가져오기 (결제 후 세션 불일치 방지)
  try {
    const User = require("../model/user");
    const dbUser = await User.findById(u._id).lean();
    
    if (!dbUser) {
      req.flash?.("error", "User not found.");
      return res.redirect("/user/login");
    }

    const hasActiveTutorAccess =
      isTutorActiveByFlag(dbUser) || isTutorActiveByAccess(dbUser);

    if (!hasActiveTutorAccess) {
      req.flash?.(
        "error",
        "Please purchase or renew Tutor Visibility before creating your tutor profile."
      );
      return res.redirect("/user/online-tutors/visibility"); // 튜터 결제/구매 페이지 경로
    }

    return next();
  } catch (err) {
    console.error("requireActiveTutorAccess error:", err);
    return res.status(500).send("Error checking tutor access");
  }
};
