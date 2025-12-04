// router/user.js
"use strict";

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const User = require("../model/user");
const JobVacancy = require("../model/jobVacancy");
const OnlineTutor = require("../model/onlineTutor");
const Thread = require("../model/thread");
const JobSeeker = require("../model/jobSeeker");

const methodOverride = require("method-override");
const requireAdmin = require("../middleware/requireAdmin");
const {
  requireLogin,
  requireRole /*, requirePaidEmployer*/,
} = require("../middleware/auth");

router.use(methodOverride("_method"));

/* --------------------------- Register --------------------------- */
router.get("/register", (req, res) => {
  res.render("user/register");
});

router.get("/register-mobile", (req, res) => {
  res.render("user/register-mobile");
});

// Mobile register - redirects to payment after registration
router.post("/register-mobile", async (req, res) => {
  let { username, email, password, role } = req.body;
  const confirmPassword = req.body["password-confirm"];

  // normalize role
  if (role === "JobSeeker" || role === "Job Seeker") role = "Job_Seeker";
  else if (role === "OnlineTutor" || role === "Online Tutor")
    role = "Online_Tutor";

  try {
    // Server-side password validation
    if (password !== confirmPassword) {
      return res.status(400).send("❌ Passwords do not match.");
    }

    // Check password strength (minimum requirements)
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const strengthScore = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (strengthScore < 3) {
      return res.status(400).send("❌ Password is too weak. Please use a stronger password with at least 3 of the following: uppercase letters, lowercase letters, numbers, and special characters.");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).send("This email is already registered.");

    const newUser = new User({ username, email, password, role });
    await newUser.save();

    req.session.user = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };

    // Redirect to payment based on role
    if (role === "Employer") {
      return res.redirect("/portone/checkout?type=employer");
    } else if (role === "Job_Seeker") {
      return res.redirect("/portone/checkout?type=resume&accessPeriod=30");
    } else if (role === "Online_Tutor") {
      return res.redirect("/portone/checkout?type=tutor&accessPeriod=30");
    }

    return res.redirect("/user/mypage");
  } catch (err) {
    console.error("❌ Registration error:", err.message);
    return res.status(500).send("❌ Registration failed.");
  }
});

router.post("/register", async (req, res) => {
  let { username, email, password, role } = req.body;
  const confirmPassword = req.body["password-confirm"];

  // normalize role
  if (role === "JobSeeker" || role === "Job Seeker") role = "Job_Seeker";
  else if (role === "OnlineTutor" || role === "Online Tutor")
    role = "Online_Tutor";
  // Employer는 그대로 사용

  try {
    // Server-side password validation
    if (password !== confirmPassword) {
      return res.status(400).send("❌ Passwords do not match.");
    }

    // Check password strength (minimum requirements)
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const strengthScore = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (strengthScore < 3) {
      return res.status(400).send("❌ Password is too weak. Please use a stronger password with at least 3 of the following: uppercase letters, lowercase letters, numbers, and special characters.");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(409).send("This email is already registered.");

    const newUser = new User({ username, email, password, role });
    await newUser.save();

    req.session.user = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };
    return res.redirect("/user/mypage");
  } catch (err) {
    console.error("❌ Registration error:", err.message);
    return res.status(500).send("❌ Registration failed.");
  }
});

/* --------------------------- Login / Logout --------------------------- */
router.get("/login", (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.render("user/login");
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  // Prevent caching
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      // Destroy any existing session to prevent "Unknown role" issue
      req.session.destroy((err) => {
        if (err) console.error('Session destroy error on login failure:', err);
      });
      
      return res.render("user/login", {
        error: `❌ Email or password incorrect<br>
                New here? <a href="/user/register" style="color:gold;text-decoration:underline;">Register</a> and choose your role.`,
      });
    }
    
    // Check if user has a valid role
    if (!user.role || !['Employer', 'Job_Seeker', 'Online_Tutor', 'Admin'].includes(user.role)) {
      console.error(`❌ User ${user.email} has invalid role: ${user.role}`);
      return res.render("user/login", {
        error: `❌ Your account has an invalid role. Please contact support.`,
      });
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      resumeAccess: user.resumeAccess ?? null,
      tutorAccess: user.tutorAccess ?? null,
      adsAvailable: user.adsAvailable || 0,
    };
    
    // Set initial activity timestamp
    req.session.lastActivity = Date.now();

    // 선택: 로그인 로깅 (실패해도 무시)
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

    console.log(`✅ User ${user.email} logged in with role: ${user.role}`);
    return res.redirect("/user/mypage");
  } catch (err) {
    console.error("❌ Login error:", err.message);
    return res.status(500).send("❌ Login failed.");
  }
});

router.get("/logout", (req, res) =>
  req.session.destroy(() => res.redirect("/"))
);

/* --------------------------- Forgot Password --------------------------- */
router.get("/forgot-password", (req, res) => {
  res.render("user/forgot-password");
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return res.render("user/forgot-password", {
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const crypto = require("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Set token and expiry (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetUrl = `${process.env.BASE_URL || "https://eslplus.org"}/user/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Password Reset Request - ESL Plus",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF7A00;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>You recently requested to reset your password for your ESL Plus account. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">ESL Plus - Your English Language Learning Partner</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.render("user/forgot-password", {
      message: "If an account exists with this email, a password reset link has been sent. Please check your inbox.",
    });
  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    return res.render("user/forgot-password", {
      error: "❌ An error occurred. Please try again later.",
    });
  }
});

/* --------------------------- Reset Password --------------------------- */
router.get("/reset-password/:token", async (req, res) => {
  try {
    const crypto = require("crypto");
    const resetTokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("user/forgot-password", {
        error: "❌ Password reset token is invalid or has expired. Please request a new one.",
      });
    }

    return res.render("user/reset-password", { token: req.params.token });
  } catch (err) {
    console.error("❌ Reset password GET error:", err.message);
    return res.status(500).send("❌ An error occurred.");
  }
});

router.post("/reset-password/:token", async (req, res) => {
  const { password } = req.body;
  const confirmPassword = req.body["password-confirm"];

  try {
    // Validate passwords match
    if (password !== confirmPassword) {
      return res.render("user/reset-password", {
        token: req.params.token,
        error: "❌ Passwords do not match.",
      });
    }

    // Check password strength
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const strengthScore = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (strengthScore < 3) {
      return res.render("user/reset-password", {
        token: req.params.token,
        error: "❌ Password is too weak. Please use a stronger password.",
      });
    }

    // Find user with valid token
    const crypto = require("crypto");
    const resetTokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("user/forgot-password", {
        error: "❌ Password reset token is invalid or has expired. Please request a new one.",
      });
    }

    // Update password and clear reset token
    user.password = password; // Note: In production, you should hash this!
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "Password Successfully Reset - ESL Plus",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">✓ Password Successfully Reset</h2>
          <p>Hello ${user.username},</p>
          <p>Your password has been successfully reset.</p>
          <p>You can now log in with your new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.BASE_URL || "https://eslplus.org"}/user/login" style="background-color: #FF7A00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Login Now</a>
          </div>
          <p>If you didn't make this change, please contact support immediately.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">ESL Plus - Your English Language Learning Partner</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error("⚠️ Failed to send confirmation email:", emailErr.message);
      // Don't fail the password reset if email fails
    }

    // Redirect to login with success message
    return res.render("user/login", {
      success: `✅ Your password has been successfully reset! Please log in with your new password.`,
      email: user.email // Pre-fill email for convenience
    });
  } catch (err) {
    console.error("❌ Reset password POST error:", err.message);
    return res.render("user/reset-password", {
      token: req.params.token,
      error: "❌ An error occurred. Please try again.",
    });
  }
});

/* --------------------------- Mypage switch --------------------------- */
router.get("/mypage", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) {
      console.error(`❌ User not found in DB: ${req.session.user._id}`);
      req.session.destroy();
      return res.redirect('/user/login?error=User account not found. Please login again.');
    }

    // Sync session role with DB role (in case it changed)
    if (user.role !== req.session.user.role) {
      console.log(`🔄 Updating session role: ${req.session.user.role} → ${user.role}`);
      req.session.user.role = user.role;
      req.user.role = user.role;
    }

    if (user.role === "Employer") return res.redirect("/user/mypage-employer");
    if (user.role === "Job_Seeker")
      return res.redirect("/user/mypage-jobseeker");
    if (user.role === "Online_Tutor") return res.redirect("/user/mypage-tutor");
    if (user.role === "Admin") return res.redirect("/admin/dashboard");

    // If role is invalid or unknown
    console.error(`❌ Unknown role for user ${user.email}: ${user.role}`);
    return res.status(400).send(`
      <div style="max-width: 600px; margin: 100px auto; padding: 40px; text-align: center; font-family: Arial, sans-serif;">
        <h1 style="color: #dc3545; font-size: 3rem; margin-bottom: 20px;">⚠️ Unknown Role</h1>
        <p style="font-size: 1.2rem; color: #666; margin-bottom: 30px;">
          Your account has an invalid role: <strong>${user.role || 'None'}</strong>
        </p>
        <p style="color: #666; margin-bottom: 30px;">
          This usually happens if your account data was corrupted. Please contact support.
        </p>
        <div style="margin-top: 30px;">
          <p><strong>Your Account:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Username: ${user.username}</p>
        </div>
        <div style="margin-top: 40px;">
          <a href="/user/logout" style="background-color: #FF7A00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">Logout</a>
          <a href="/inquiry" style="background-color: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Contact Support</a>
        </div>
      </div>
    `);
  } catch (err) {
    console.error("❌ Failed to load mypage:", err.message);
    return res.status(500).send("❌ Error loading My Page");
  }
});

// --------------------------- Employer mypage (credits-based) ---------------------------
router.get(
  "/mypage-employer",
  requireLogin,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.session.user._id).lean();
      if (!user) return res.status(404).send("User not found");

      // Sync session role with DB role (in case it changed)
      if (user.role !== req.session.user.role) {
        console.log(`🔄 [mypage-employer] Updating session role: ${req.session.user.role} → ${user.role}`);
        req.session.user.role = user.role;
        req.user.role = user.role;
      }

      // Check role after sync
      if (user.role !== "Employer") {
        return res.status(403).send(`
          <h3>Access Denied</h3>
          <p>This page is for Employers only.</p>
          <p>Your role: <strong>${user.role}</strong></p>
          <p><a href="/user/mypage">Go to My Page</a></p>
        `);
      }

      // 남은 광고 크레딧
      const credits = Number(user.adsAvailable || 0);

      // 내가 올린 공고 수
      const activeJobs = await JobVacancy.countDocuments({ user: user._id });

      // 버튼 노출 조건
      const canPost = credits > 0;
      
      // 구매 내역 조회
      const Payment = require('../model/payment');
      const payments = await Payment.find({ 
        userId: user._id,
        status: { $in: ['paid', 'refunded'] }
      }).sort({ paidAt: -1 }).limit(10).lean();

      return res.render("user/mypage-employer", {
        user,
        activeJobs,
        credits,
        canPost,
        totalSlots: activeJobs + credits,
        remainingSlots: credits,
        payments: payments || []
      });
    } catch (err) {
      console.error("Employer mypage error:", err.message);
      return next(err);
    }
  }
);

/* --------------------------- Employer plan (선택: 그대로 유지) --------------------------- */
router.get(
  "/employer/plan",
  requireLogin,
  requireRole("Employer"),
  (req, res) => res.render("employer/plan")
);

router.post(
  "/employer/plan",
  requireLogin,
  requireRole("Employer"),
  async (req, res) => {
    try {
      const { employerPeriod } = req.body; // 30 | 90 | 365
      const periodDays = parseInt(employerPeriod, 10);
      if (![30, 90, 365].includes(periodDays)) {
        return res.status(400).send("❌ Invalid employer plan period");
      }
      return res.redirect(
        `/portone/checkout?type=employer&employerPeriod=${periodDays}`
      );
    } catch (err) {
      console.error("❌ Employer plan error:", err.message);
      return res.status(500).send("❌ Failed to process employer plan");
    }
  }
);

/* --------------------------- Job Seeker mypage + payments --------------------------- */
function calcRemainingDays(resumeAccess) {
  if (!resumeAccess || !resumeAccess.startDate || !resumeAccess.durationDays)
    return 0;
  const start = new Date(resumeAccess.startDate);
  const durationMs = resumeAccess.durationDays * 86400000;
  const diff = start.getTime() + durationMs - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

function calcExpiryDate(resumeAccess) {
  if (!resumeAccess || !resumeAccess.startDate || !resumeAccess.durationDays)
    return null;
  const start = new Date(resumeAccess.startDate);
  const durationMs = resumeAccess.durationDays * 86400000;
  return new Date(start.getTime() + durationMs);
}

router.get("/mypage-jobseeker", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send("User not found");

    const remainingDays = calcRemainingDays(user?.resumeAccess);
    const hasActiveResumeAccess = remainingDays > 0;
    const expiryDate = calcExpiryDate(user?.resumeAccess);

    // Find user's resume if exists
    const userResume = await JobSeeker.findOne({ email: user.email })
      .sort({ updatedAt: -1 })
      .lean();

    // Format dates for display
    const formattedExpiryDate = expiryDate
      ? expiryDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

    const formattedUpdatedAt = userResume?.updatedAt
      ? new Date(userResume.updatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A";

    // 구매 내역 조회
    const Payment = require('../model/payment');
    const payments = await Payment.find({ 
      userId: user._id,
      status: { $in: ['paid', 'refunded'] }
    }).sort({ paidAt: -1 }).limit(10).lean();

    return res.render("user/mypage-jobseeker", {
      user,
      remainingDays,
      hasActiveResumeAccess,
      expiryDate: formattedExpiryDate,
      userResume,
      hasResume: !!userResume,
      formattedUpdatedAt,
      payments: payments || []
    });
  } catch (err) {
    console.error("Job Seeker mypage error:", err.message);
    return res.status(500).send("❌ Failed to load Job Seeker Dashboard");
  }
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

    // 결제 페이지로 이동
    return res.redirect(`/portone/checkout?type=resume&accessPeriod=${periodDays}`);
  } catch (err) {
    console.error("❌ Failed to process resume access:", err.message);
    return res.status(500).send("❌ Failed to process resume access");
  }
});

/* --------------------------- Tutor mypage --------------------------- */
router.get("/mypage-tutor", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).send("User not found");

    const email = user.email || "";
    const tutor = email
      ? await OnlineTutor.findOne({ email }).sort({ updatedAt: -1 }).lean()
      : null;

    const threads = await Thread.find({
      userId: String(req.session.user._id),
      source: "online_tutors",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .catch(() => []);

    // 구매 내역 조회
    const Payment = require('../model/payment');
    const payments = await Payment.find({ 
      userId: user._id,
      status: { $in: ['paid', 'refunded'] }
    }).sort({ paidAt: -1 }).limit(10).lean();

    const data = { user, tutor, tutorDoc: tutor, threads, payments: payments || [] };

    // ✅ 폴백 제거: 오직 'user/mypage-tutor' 만 렌더
    return res.render("user/mypage-tutor", data);
  } catch (err) {
    console.error("❌ Tutor mypage error:", err.stack || err);
    return res.status(500).send("❌ Failed to load Tutor Dashboard");
  }
});

/* --------------------------- Tutor visibility purchase (GET/POST) --------------------------- */
// 버튼에서 바로 결제로 가는 엔트리
router.get("/online-tutors/visibility/start", requireLogin, (req, res) => {
  const days = parseInt(req.query.days, 10);
  if (![30, 90, 365].includes(days)) {
    return res.status(400).send("❌ Invalid tutor visibility period");
  }
  return res.redirect(`/portone/checkout?type=tutor&accessPeriod=${days}`);
});

// 설명/선택 페이지 (필요 시)
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
    return res.redirect(`/portone/checkout?type=tutor&accessPeriod=${days}`);
  } catch (e) {
    console.error("[tutor visibility] error:", e.message || e);
    return res.status(500).send("❌ Failed to process tutor visibility");
  }
});

// (선택) 구경로 별칭
router.get("/tutor/plan", (req, res) =>
  res.redirect("/user/online-tutors/visibility")
);

/* -------------------------------------------------------------
   POST /user/request-refund
   - User-initiated refund request
   - Auto-approve if conditions met, otherwise pending for admin
------------------------------------------------------------- */
router.post("/request-refund", requireLogin, async (req, res) => {
  try {
    const { paymentId, reason } = req.body;
    
    if (!paymentId || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment ID and reason are required' 
      });
    }
    
    const Payment = require('../model/payment');
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }
    
    if (payment.userId.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    if (payment.status !== 'paid') {
      return res.status(400).json({ 
        success: false, 
        message: 'This payment cannot be refunded' 
      });
    }
    
    if (payment.refundRequest && payment.refundRequest.status === 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Refund request already submitted' 
      });
    }
    
    // Auto-approval conditions
    const daysSincePurchase = (Date.now() - payment.paidAt) / (1000 * 60 * 60 * 24);
    let autoApprove = false;
    let autoApproveReason = '';
    
    // Condition 1: Within 7 days of purchase
    if (daysSincePurchase <= 7) {
      autoApprove = true;
      autoApproveReason = 'Within 7-day refund period';
    }
    
    // Condition 2: Check if service was unused
    if (autoApprove) {
      const user = await User.findById(payment.userId);
      
      if (payment.packageType === 'job_ads') {
        // Check if any job ads were posted after payment
        const JobVacancy = require('../model/jobVacancy');
        const adsPostedAfter = await JobVacancy.countDocuments({
          user: user._id,
          postedDate: { $gte: payment.paidAt }
        });
        
        if (adsPostedAfter > 0) {
          autoApprove = false;
          autoApproveReason = 'Service already used (ads posted)';
        }
      }
    }
    
    if (autoApprove) {
      // Auto-approve: Process refund immediately
      payment.refundRequest = {
        requestedAt: new Date(),
        reason: reason,
        status: 'auto_approved',
        autoApproved: true,
        reviewedAt: new Date(),
        reviewNote: autoApproveReason
      };
      
      await payment.save();
      
      // Process refund via PortOne API
      const axios = require('axios');
      const portoneApiSecret = process.env.PORTONE_API_SECRET;
      
      try {
        // Step 1: Get Access Token
        const tokenResponse = await axios.post(
          'https://api.portone.io/login/api-secret',
          {
            api_secret: portoneApiSecret
          }
        );
        
        const accessToken = tokenResponse.data.access_token;
        
        // Step 2: Get payment details from PortOne (verify current status)
        const portonePaymentResponse = await axios.get(
          `https://api.portone.io/payments/${payment.paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        const portonePayment = portonePaymentResponse.data;
        
        // Step 3: Request Refund with cancelable_amount
        const refundResponse = await axios.post(
          `https://api.portone.io/payments/${payment.paymentId}/cancel`,
          {
            reason: `Auto-approved: ${reason}`,
            amount: payment.amount,
            cancelable_amount: portonePayment.amount
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Update payment status
        payment.status = 'refunded';
        payment.refundedAt = new Date();
        payment.refundAmount = payment.amount;
        payment.refundReason = reason;
        
        // Deduct credits/access
        const user = await User.findById(payment.userId);
        if (payment.packageType === 'job_ads') {
          user.adsAvailable = Math.max(0, (user.adsAvailable || 0) - (payment.packageDetails.quantity || 0));
        } else if (payment.packageType === 'resume_access') {
          if (user.resumeAccess) user.resumeAccess.isActive = false;
        } else if (payment.packageType === 'tutor_access') {
          if (user.tutorAccess) user.tutorAccess.isActive = false;
        }
        await user.save();
        await payment.save();
        
        console.log(`✅ Auto-approved refund: ${payment._id}`);
        
        return res.json({ 
          success: true, 
          autoApproved: true,
          message: 'Refund approved and processed automatically' 
        });
        
      } catch (apiError) {
        console.error('❌ Auto-refund API error:', {
          message: apiError.message,
          response: apiError.response?.data,
          status: apiError.response?.status,
          paymentId: payment.paymentId
        });
        
        // Keep as pending if API fails
        payment.refundRequest.status = 'pending';
        payment.refundRequest.autoApproved = false;
        payment.refundRequest.reviewNote = `API error: ${apiError.message}`;
        await payment.save();
        
        // Return detailed error to frontend for debugging
        return res.status(500).json({ 
          success: false,
          message: `Refund failed: ${apiError.response?.data?.message || apiError.message}`,
          error: apiError.response?.data || apiError.message
        });
      }
      
    } else {
      // Pending: Requires admin approval
      payment.refundRequest = {
        requestedAt: new Date(),
        reason: reason,
        status: 'pending',
        autoApproved: false,
        reviewNote: autoApproveReason || 'Requires admin review'
      };
      
      await payment.save();
      
      console.log(`📌 Refund request pending: ${payment._id}`);
      
      return res.json({ 
        success: true, 
        autoApproved: false,
        message: 'Refund request submitted. Our team will review it within 1-2 business days.' 
      });
    }
    
  } catch (err) {
    console.error('❌ Refund request error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process refund request' 
    });
  }
});

module.exports = router;
