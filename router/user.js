// router/user.js
"use strict";

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const methodOverride = require("method-override");

const User = require("../model/user");
const JobVacancy = require("../model/jobVacancy");
const OnlineTutor = require("../model/onlineTutor");
const Thread = require("../model/thread");

// ✅ 프로모션 헬퍼
const { isYearEnd2025Open, applyYearEnd2025 } = require("../lib/promo");

// 미들웨어
const requireAdmin = require("../middleware/requireAdmin");
const { requireLogin, requireRole /*, requirePaidEmployer*/ } = require("../middleware/auth");

router.use(methodOverride("_method"));

/* ------------------------------------------------------------------ *
 * 유틸
 * ------------------------------------------------------------------ */
function normalizeRole(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "employer" || raw === "employer / recruiter") return "Employer";
  if (raw === "job_seeker" || raw === "job seeker" || raw === "jobseeker") return "Job_Seeker";
  if (raw === "tutor" || raw === "online_tutor" || raw === "online tutor" || raw === "onlinetutor") return "Online_Tutor";
  // 이미 정규 형태로 들어온 경우 패스
  if (["Employer", "Job_Seeker", "Online_Tutor"].includes(input)) return input;
  return ""; // 잘못된 값
}

/* ------------------------------------------------------------------ *
 * 회원가입 (GET)
 * 실제 경로: /user/register   (app.use("/user", router) 기준)
 * ------------------------------------------------------------------ */
router.get("/register", (req, res) => {
  const { promo = "", prefRole = "", next = "" } = req.query || {};
  const promoOpen = isYearEnd2025Open();
  return res.render("user/register", {
    promo,           // ex) 'yearend2025'
    promoOpen,       // 뷰에서 배지/안내 표시용
    prefRole,        // 선택 기본값
    next,            // 가입 후 보낼 위치
    values: {},      // 폼 재표시용
    errors: {},      // 오류 표시용
  });
});

/* ------------------------------------------------------------------ *
 * 회원가입 (POST)  ✅ 프로모션 적용 포함
 * 실제 경로: /user/register
 * ------------------------------------------------------------------ */
router.post("/register", async (req, res) => {
  try {
    // 입력값
    const hp = (req.body.hp || "").trim(); // 허니팟(봇 차단)
    const username = (req.body.username || req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const passwordConfirm = req.body.passwordConfirm || "";
    const role = normalizeRole(req.body.role);
    const promo = (req.body.promo || req.query.promo || "").trim().toLowerCase();
    const prefRole = req.body.prefRole || req.query.prefRole || "";
    const next = (req.body.next || req.query.next || "").trim();

    const errors = {};
    const values = { name: username, email, role: (req.body.role || "").trim() };

    // 허니팟
    if (hp) {
      return res.status(400).render("user/register", {
        promo,
        promoOpen: isYearEnd2025Open(),
        prefRole,
        next,
        values,
        errors: { _global: "Bot suspected." },
      });
    }

    // 검증
    if (!username) errors.name = "Name is required.";
    if (!email) errors.email = "Email is required.";
    if (!password) errors.password = "Password is required.";
    if (password && passwordConfirm && password !== passwordConfirm) {
      errors.passwordConfirm = "Passwords do not match.";
    }
    if (!role) errors.role = "Please choose your role.";

    if (Object.keys(errors).length) {
      return res.status(400).render("user/register", {
        promo,
        promoOpen: isYearEnd2025Open(),
        prefRole,
        next,
        values,
        errors,
      });
    }

    // 중복 이메일 검사
    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(409).render("user/register", {
        promo,
        promoOpen: isYearEnd2025Open(),
        prefRole,
        next,
        values,
        errors: { _global: "This email is already registered." },
      });
    }

    // 사용자 생성
    const user = new User({
      username,
      email,
      password, // (기존 로직 유지: 해시 미적용 프로젝트라면 나중에 교체)
      role,     // 'Employer' | 'Job_Seeker' | 'Online_Tutor'
    });

    // ✅ 프로모션 적용
    if (promo === "yearend2025" && isYearEnd2025Open()) {
      try {
        applyYearEnd2025(user, role);
      } catch (e) {
        console.error("[promo] apply error:", e);
        // 프로모션 적용 실패해도 가입 자체는 진행
      }
    }

    await user.save();

    // 세션
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      // 필요 시 세션에 복사
      adsAvailable: user.adsAvailable ?? undefined,
      promo: user.promo ?? undefined,
      resumeAccess: user.resumeAccess ?? undefined,
      tutorAccess: user.tutorAccess ?? undefined,
      membership: user.membership ?? undefined,
    };

    // 가입 후 이동
    let redirectTo = next || "/user/mypage";
    if (!next) {
      if (role === "Employer") {
        redirectTo = "/user/mypage-employer?promo=yearend2025";
      } else if (role === "Job_Seeker") {
        redirectTo = "/user/mypage-jobseeker?promo=yearend2025";
      } else if (role === "Online_Tutor") {
        redirectTo = "/user/mypage-tutor?promo=yearend2025";
      }
    }

    return res.redirect(redirectTo);
  } catch (err) {
    console.error("❌ Registration error:", err);
    return res.status(500).render("user/register", {
      promo: (req.body.promo || req.query.promo || "").toLowerCase(),
      promoOpen: isYearEnd2025Open(),
      prefRole: req.body.prefRole || req.query.prefRole || "",
      next: req.body.next || req.query.next || "",
      values: {
        name: req.body.username || req.body.name || "",
        email: req.body.email || "",
        role: req.body.role || "",
      },
      errors: { _global: "Registration failed. Please try again." },
    });
  }
});

/* ------------------------------------------------------------------ *
 * 로그인 / 로그아웃
 * 실제 경로: /user/login, /user/logout
 * ------------------------------------------------------------------ */
router.get("/login", (req, res) => res.render("user/login"));

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.render("user/login", {
        error:
          `❌ Email or password incorrect<br>` +
          `New here? <a href="/user/register" style="color:gold;text-decoration:underline;">Register</a> and choose your role.`,
      });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      resumeAccess: user.resumeAccess ?? null,
      tutorAccess: user.tutorAccess ?? null,
      adsAvailable: user.adsAvailable ?? null,
      membership: user.membership ?? null,
      promo: user.promo ?? null,
    };

    try {
      const { logThread } = require("../utils/threadLog");
      await logThread(req, {
        type: "auth",
        action: "login",
        source: "auth",
        sourceId: String(user._id),
        title: "Login",
        summary: `user=${user.email}`,
      });
    } catch (e) {
      console.error("[thread] login log failed:", e.message || e);
    }

    return res.redirect("/user/mypage");
  } catch (err) {
    console.error("❌ Login error:", err.message);
    return res.status(500).send("❌ Login failed.");
  }
});

router.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

/* ------------------------------------------------------------------ *
 * 마이페이지 스위치
 * 실제 경로: /user/mypage
 * ------------------------------------------------------------------ */
router.get("/mypage", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send("User not found");

    if (user.role === "Employer")      return res.redirect("/user/mypage-employer");
    if (user.role === "Job_Seeker")    return res.redirect("/user/mypage-jobseeker");
    if (user.role === "Online_Tutor")  return res.redirect("/user/mypage-tutor");

    return res.send("Unknown role");
  } catch (err) {
    console.error("❌ Failed to load mypage:", err.message);
    return res.status(500).send("❌ Error loading My Page");
  }
});

/* ------------------------------------------------------------------ *
 * Employer mypage
 * 실제 경로: /user/mypage-employer
 * ------------------------------------------------------------------ */
router.get(
  "/mypage-employer",
  requireLogin,
  requireRole("Employer"),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.session.user._id).lean();
      if (!user) return res.status(404).send("User not found");

      const credits = Number(user.adsAvailable || 0);
      const activeJobs = await JobVacancy.countDocuments({ user: user._id });
      const canPost = credits > 0;

      return res.render("user/mypage-employer", {
        user,
        activeJobs,
        credits,
        canPost,
      });
    } catch (err) {
      console.error("Employer mypage error:", err.message);
      return next(err);
    }
  }
);

/* ------------------------------------------------------------------ *
 * (기존 결제 플로우 유지: 필요 시)
 * 실제 경로: /user/employer/plan
 * ------------------------------------------------------------------ */
router.get("/employer/plan", requireLogin, requireRole("Employer"), (req, res) =>
  res.render("employer/plan")
);

router.post("/employer/plan", requireLogin, requireRole("Employer"), async (req, res) => {
  try {
    const { employerPeriod } = req.body; // 30 | 90 | 365
    const periodDays = parseInt(employerPeriod, 10);
    if (![30, 90, 365].includes(periodDays)) {
      return res.status(400).send("❌ Invalid employer plan period");
    }
    return res.redirect(`/paypal/checkout?type=employer&employerPeriod=${periodDays}`);
  } catch (err) {
    console.error("❌ Employer plan error:", err.message);
    return res.status(500).send("❌ Failed to process employer plan");
  }
});

/* ------------------------------------------------------------------ *
 * Job Seeker mypage
 * 실제 경로: /user/mypage-jobseeker
 * ------------------------------------------------------------------ */
function calcRemainingDays(resumeAccess) {
  if (!resumeAccess || !resumeAccess.startDate || !resumeAccess.durationDays) return 0;
  const start = new Date(resumeAccess.startDate);
  const durationMs = resumeAccess.durationDays * 86400000;
  const diff = start.getTime() + durationMs - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

router.get("/mypage-jobseeker", requireLogin, async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();

  const remainingDays = calcRemainingDays(user?.resumeAccess);
  const hasActiveResumeAccess = remainingDays > 0;

  return res.render("user/mypage-jobseeker", {
    user,
    remainingDays,
    hasActiveResumeAccess,
    purchaseLink: "/user/job-seekers/resume-access",
  });
});

router.get("/job-seekers/resume-access", requireLogin, (req, res) => {
  return res.render("jobSeeker/resumeAccess");
});

router.post("/job-seekers/resume-access", requireLogin, async (req, res) => {
  try {
    const { accessPeriod } = req.body;
    const periodDays = parseInt(accessPeriod, 10);

    if (![30, 90, 365].includes(periodDays)) {
      return res.status(400).send("❌ Invalid access period");
    }

    return res.redirect(`/paypal/checkout?accessPeriod=${periodDays}`);
  } catch (err) {
    console.error("❌ Failed to process resume access:", err.message);
    return res.status(500).send("❌ Failed to process resume access");
  }
});

/* ------------------------------------------------------------------ *
 * Tutor mypage
 * 실제 경로: /user/mypage-tutor
 * ------------------------------------------------------------------ */
router.get("/mypage-tutor", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send("User not found");

    const email = user.email || "";
    const tutor = email ? await OnlineTutor.findOne({ email }).sort({ updatedAt: -1 }).lean() : null;

    const threads = await Thread.find({
      userId: String(req.session.user._id),
      source: "online_tutors",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .catch(() => []);

    return res.render("user/mypage-tutor", { user, tutor, tutorDoc: tutor, threads });
  } catch (err) {
    console.error("❌ Tutor mypage error:", err.stack || err);
    return res.status(500).send("❌ Failed to load Tutor Dashboard");
  }
});

/* ------------------------------------------------------------------ *
 * Tutor visibility (결제 플로우 – 필요 시)
 * 실제 경로: /user/online-tutors/visibility*
 * ------------------------------------------------------------------ */
router.get("/online-tutors/visibility/start", requireLogin, (req, res) => {
  const days = parseInt(req.query.days, 10);
  if (![30, 90, 365].includes(days)) {
    return res.status(400).send("❌ Invalid tutor visibility period");
  }
  return res.redirect(`/paypal/checkout?type=tutor&accessPeriod=${days}`);
});

router.get("/online-tutors/visibility", requireLogin, (req, res) => {
  return res.render("onlineTutor/visibility", {
    user: req.session.user,
    pageTitle: "Purchase Tutor Visibility",
  });
});

router.post("/online-tutors/visibility", requireLogin, async (req, res) => {
  try {
    const { accessPeriod } = req.body; // 30 | 90 | 365
    const days = parseInt(accessPeriod, 10);
    if (![30, 90, 365].includes(days)) {
      return res.status(400).send("❌ Invalid tutor visibility period");
    }
    return res.redirect(`/paypal/checkout?type=tutor&accessPeriod=${days}`);
  } catch (e) {
    console.error("[tutor visibility] error:", e.message || e);
    return res.status(500).send("❌ Failed to process tutor visibility");
  }
});

// (구 경로 별칭)
router.get("/tutor/plan", (req, res) =>
  res.redirect("/user/online-tutors/visibility")
);

module.exports = router;
