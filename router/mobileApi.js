// router/mobileApi.js - JSON API for Flutter Mobile App
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// Models
const User = require("../model/user");
const JobVacancy = require("../model/jobVacancy");
const OnlineTutor = require("../model/onlineTutor");
const JobSeeker = require("../model/jobSeeker");

// Config
const priceConfig = require("../config/priceConfig");
const resumePriceConfig = require("../config/resumePriceConfig");
const tutorPriceConfig = require("../config/tutorPriceConfig");

/* -------------------- helpers -------------------- */
const toArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const sanitizeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const coalesce = (...fields) => {
  if (fields.length === 0) return null;
  return fields.reduceRight((acc, cur) => ({ $ifNull: [cur, acc] }));
};

/* -------------------- 클래스별 패싯 설정 -------------------- */
const FACET_MAP = {
  Job_Vacancies: {
    groups: [
      { key: "country", aliases: ["Country"], label: "Country" },
      { key: "studentType", aliases: ["StudentType"], label: "Student Type" },
      {
        key: "teachingArea",
        aliases: ["Teaching_Area"],
        label: "Teaching Area",
        array: true,
      },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
  },
  Job_Seekers: {
    groups: [
      { key: "Nationality", aliases: ["nationality"], label: "Nationality" },
      { key: "Preferred_Work_Location", aliases: ["preferredWorkLocation", "preferred_work_location"], label: "Preferred Work Location" },
      { key: "Major", aliases: ["major"], label: "Major" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
  },
  Online_Tutors: {
    groups: [
      { key: "Expertise", label: "Expertise", array: true },
      { key: "Tutoring_Experience", label: "Tutoring Experience" },
      { key: "Gender", label: "Gender" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
  },
};

/* ===================== AUTH APIs ===================== */

/* POST /api/register-and-redirect - 모바일 회원가입 (리다이렉트 버전) */
router.post("/register-and-redirect", async (req, res) => {
  try {
    let { username, email, password, passwordConfirm, role } = req.body;

    // Validate required fields
    if (!username || !email || !password || !passwordConfirm || !role) {
      return res.status(400).send("All fields are required");
    }

    // Password match check
    if (password !== passwordConfirm) {
      return res.status(400).send("Passwords do not match");
    }

    // Password strength validation
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const strengthScore = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (strengthScore < 3) {
      return res.status(400).send("Password is too weak");
    }

    // Normalize role
    if (role === "JobSeeker" || role === "Job Seeker") role = "Job_Seeker";
    else if (role === "OnlineTutor" || role === "Online Tutor") role = "Online_Tutor";

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send("This email is already registered");
    }

    // Create new user
    const newUser = new User({ username, email, password, role });
    await newUser.save();

    // Set session
    req.session.user = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };

    // Redirect to payment page based on role
    if (role === "Employer") {
      return res.redirect("/paddle/checkout?type=employer");
    } else if (role === "Job_Seeker") {
      return res.redirect("/paddle/checkout?type=resume&accessPeriod=30");
    } else if (role === "Online_Tutor") {
      return res.redirect("/paddle/checkout?type=tutor&accessPeriod=30");
    }

    return res.redirect("/user/mypage");
  } catch (err) {
    console.error("❌ Mobile registration error:", err.message);
    return res.status(500).send("Registration failed");
  }
});

/* POST /api/register - 모바일 회원가입 */
router.post("/register", async (req, res) => {
  try {
    let { username, email, password, passwordConfirm, role } = req.body;

    // Validate required fields
    if (!username || !email || !password || !passwordConfirm || !role) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    // Password match check
    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match",
      });
    }

    // Password strength validation
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const strengthScore = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (strengthScore < 3) {
      return res.status(400).json({
        success: false,
        error: "Password is too weak. Please use a stronger password with at least 3 of the following: uppercase letters, lowercase letters, numbers, and special characters.",
      });
    }

    // Normalize role
    if (role === "JobSeeker" || role === "Job Seeker") role = "Job_Seeker";
    else if (role === "OnlineTutor" || role === "Online Tutor") role = "Online_Tutor";

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "This email is already registered",
      });
    }

    // Create new user
    const newUser = new User({ username, email, password, role });
    await newUser.save();

    // Return user data (without password)
    const userData = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      adsAvailable: 0,
      resumeAccess: null,
      tutorAccess: null,
    };

    // Determine next step based on role
    let nextStep = {
      action: "view_dashboard",
      message: "Registration successful! Please check your dashboard.",
      needsPayment: true,
      paymentType: null,
    };

    if (role === "Employer") {
      nextStep.paymentType = "employer";
      nextStep.message = "Registration successful! You need to purchase ad credits to post job vacancies.";
      nextStep.buttonText = "Buy Ad Credits";
    } else if (role === "Job_Seeker") {
      nextStep.paymentType = "resume";
      nextStep.message = "Registration successful! You need to purchase resume access to add your resume.";
      nextStep.buttonText = "Purchase Resume Access";
    } else if (role === "Online_Tutor") {
      nextStep.paymentType = "tutor";
      nextStep.message = "Registration successful! You need to purchase tutor visibility to be listed.";
      nextStep.buttonText = "Purchase Tutor Visibility";
    }

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: userData,
      nextStep,
    });
  } catch (err) {
    console.error("❌ Mobile registration error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
});

/* POST /api/login - 모바일 로그인 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        error: "Email or password incorrect",
      });
    }

    // Return user data (without password)
    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      adsAvailable: user.adsAvailable || 0,
      resumeAccess: user.resumeAccess || null,
      tutorAccess: user.tutorAccess || null,
      createdAt: user.createdAt,
    };

    // Determine next step based on role and current status
    let nextStep = {
      action: "view_dashboard",
      needsPayment: false,
      paymentType: null,
      canUseFeatures: false,
    };

    if (user.role === "Employer") {
      const hasCredits = (user.adsAvailable || 0) > 0;
      nextStep.needsPayment = !hasCredits;
      nextStep.canUseFeatures = hasCredits;
      nextStep.paymentType = "employer";
      
      if (hasCredits) {
        nextStep.message = `You have ${user.adsAvailable} ad credits. You can post job vacancies.`;
        nextStep.buttonText = "Post New Job";
        nextStep.action = "post_job";
      } else {
        nextStep.message = "You need to purchase ad credits to post job vacancies.";
        nextStep.buttonText = "Buy Ad Credits";
        nextStep.action = "buy_credits";
      }
    } else if (user.role === "Job_Seeker") {
      const remainingDays = calcRemainingDays(user.resumeAccess);
      const hasAccess = remainingDays > 0;
      nextStep.needsPayment = !hasAccess;
      nextStep.canUseFeatures = hasAccess;
      nextStep.paymentType = "resume";
      
      if (hasAccess) {
        nextStep.message = `Your resume access is active for ${remainingDays} more days.`;
        nextStep.buttonText = "Add/Edit Resume";
        nextStep.action = "manage_resume";
      } else {
        nextStep.message = "You need to purchase resume access to add your resume.";
        nextStep.buttonText = "Purchase Resume Access";
        nextStep.action = "buy_access";
      }
    } else if (user.role === "Online_Tutor") {
      const remainingDays = calcRemainingDays(user.tutorAccess);
      const hasAccess = remainingDays > 0;
      nextStep.needsPayment = !hasAccess;
      nextStep.canUseFeatures = hasAccess;
      nextStep.paymentType = "tutor";
      
      if (hasAccess) {
        nextStep.message = `Your tutor listing is active for ${remainingDays} more days.`;
        nextStep.buttonText = "Add/Edit Profile";
        nextStep.action = "manage_profile";
      } else {
        nextStep.message = "You need to purchase tutor visibility to be listed.";
        nextStep.buttonText = "Purchase Tutor Visibility";
        nextStep.action = "buy_visibility";
      }
    }

    return res.json({
      success: true,
      message: "Login successful",
      user: userData,
      nextStep,
    });
  } catch (err) {
    console.error("❌ Mobile login error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
});

/* GET /api/mypage/:userId - 마이페이지 정보 조회 */
router.get("/mypage/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password").lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const response = {
      success: true,
      user,
    };

    // Role-specific data and next step
    let nextStep = {
      action: "view_dashboard",
      needsPayment: false,
      paymentType: null,
      canUseFeatures: false,
    };

    if (user.role === "Employer") {
      const activeJobs = await JobVacancy.countDocuments({ user: user._id });
      const credits = Number(user.adsAvailable || 0);
      const hasCredits = credits > 0;
      
      response.employer = {
        activeJobs,
        credits,
        canPost: hasCredits,
        totalSlots: activeJobs + credits,
        remainingSlots: credits,
      };

      nextStep.needsPayment = !hasCredits;
      nextStep.canUseFeatures = hasCredits;
      nextStep.paymentType = "employer";
      
      if (hasCredits) {
        nextStep.message = `You have ${credits} ad credits. You can post job vacancies.`;
        nextStep.buttonText = "Post New Job";
        nextStep.action = "post_job";
      } else {
        nextStep.message = "You need to purchase ad credits to post job vacancies.";
        nextStep.buttonText = "Buy Ad Credits";
        nextStep.action = "buy_credits";
      }
    } else if (user.role === "Job_Seeker") {
      const remainingDays = calcRemainingDays(user?.resumeAccess);
      const hasActiveResumeAccess = remainingDays > 0;
      const expiryDate = calcExpiryDate(user?.resumeAccess);
      
      const userResume = await JobSeeker.findOne({ email: user.email })
        .sort({ updatedAt: -1 })
        .lean();

      response.jobSeeker = {
        remainingDays,
        hasActiveResumeAccess,
        expiryDate,
        hasResume: !!userResume,
        resume: userResume,
      };

      nextStep.needsPayment = !hasActiveResumeAccess;
      nextStep.canUseFeatures = hasActiveResumeAccess;
      nextStep.paymentType = "resume";
      
      if (hasActiveResumeAccess) {
        nextStep.message = `Your resume access is active for ${remainingDays} more days.`;
        nextStep.buttonText = "Add/Edit Resume";
        nextStep.action = "manage_resume";
      } else {
        nextStep.message = "You need to purchase resume access to add your resume.";
        nextStep.buttonText = "Purchase Resume Access";
        nextStep.action = "buy_access";
      }
    } else if (user.role === "Online_Tutor") {
      const tutor = await OnlineTutor.findOne({ email: user.email })
        .sort({ updatedAt: -1 })
        .lean();

      const remainingDays = calcRemainingDays(user?.tutorAccess);
      const hasActiveTutorAccess = remainingDays > 0;
      const expiryDate = calcExpiryDate(user?.tutorAccess);

      response.tutor = {
        remainingDays,
        hasActiveTutorAccess,
        expiryDate,
        hasTutorProfile: !!tutor,
        profile: tutor,
      };

      nextStep.needsPayment = !hasActiveTutorAccess;
      nextStep.canUseFeatures = hasActiveTutorAccess;
      nextStep.paymentType = "tutor";
      
      if (hasActiveTutorAccess) {
        nextStep.message = `Your tutor listing is active for ${remainingDays} more days.`;
        nextStep.buttonText = "Add/Edit Profile";
        nextStep.action = "manage_profile";
      } else {
        nextStep.message = "You need to purchase tutor visibility to be listed.";
        nextStep.buttonText = "Purchase Tutor Visibility";
        nextStep.action = "buy_visibility";
      }
    }

    response.nextStep = nextStep;

    return res.json(response);
  } catch (err) {
    console.error("❌ Mobile mypage error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to load user data",
    });
  }
});

/* ===================== PAYMENT APIs ===================== */

/* GET /api/payment/plans - 모든 결제 플랜 조회 */
router.get("/payment/plans", (req, res) => {
  try {
    return res.json({
      success: true,
      plans: {
        employer: priceConfig.map(p => ({
          id: p.id,
          label: p.label,
          price: p.price,
          discount: p.discount || 0,
          adCount: p.id,
        })),
        resume: resumePriceConfig.map(p => ({
          id: p.id,
          label: p.label,
          price: p.price,
          days: p.id,
        })),
        tutor: tutorPriceConfig.map(p => ({
          id: p.id,
          label: p.label,
          price: p.price,
          days: p.id,
        })),
      },
    });
  } catch (err) {
    console.error("❌ Payment plans error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to load payment plans",
    });
  }
});

/* POST /api/payment/checkout - 결제 시작 (Paddle Checkout URL 생성) */
router.post("/payment/checkout", async (req, res) => {
  try {
    const { userId, type, packageId } = req.body;

    if (!userId || !type || !packageId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, type, packageId",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    let checkoutData = {
      userId,
      type,
      packageId,
    };

    // Type-specific data
    if (type === "employer") {
      const selected = priceConfig.find(p => p.id === packageId);
      if (!selected) {
        return res.status(400).json({
          success: false,
          error: "Invalid package ID",
        });
      }
      checkoutData.price = selected.price;
      checkoutData.label = selected.label;
      checkoutData.adCount = selected.id;
    } else if (type === "resume") {
      const selected = resumePriceConfig.find(p => p.id === packageId);
      if (!selected) {
        return res.status(400).json({
          success: false,
          error: "Invalid package ID",
        });
      }
      checkoutData.price = selected.price;
      checkoutData.label = selected.label;
      checkoutData.days = selected.id;
    } else if (type === "tutor") {
      const selected = tutorPriceConfig.find(p => p.id === packageId);
      if (!selected) {
        return res.status(400).json({
          success: false,
          error: "Invalid package ID",
        });
      }
      checkoutData.price = selected.price;
      checkoutData.label = selected.label;
      checkoutData.days = selected.id;
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid payment type",
      });
    }

    // Return checkout data for mobile to handle Paddle payment
    return res.json({
      success: true,
      checkout: checkoutData,
      paddleEnvironment: process.env.PADDLE_ENVIRONMENT || "sandbox",
    });
  } catch (err) {
    console.error("❌ Payment checkout error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to create checkout",
    });
  }
});

/* ===================== HELPER FUNCTIONS ===================== */

function calcRemainingDays(access) {
  if (!access || !access.startDate || !access.durationDays) return 0;
  const start = new Date(access.startDate);
  const durationMs = access.durationDays * 86400000;
  const diff = start.getTime() + durationMs - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

function calcExpiryDate(access) {
  if (!access || !access.startDate || !access.durationDays) return null;
  const start = new Date(access.startDate);
  const durationMs = access.durationDays * 86400000;
  return new Date(start.getTime() + durationMs);
}

/* ===================== LIST APIs ===================== */

/* -------------------- JSON API 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass;
    const spec = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const coll = spec.coll ? spec.coll(klass) : `${klass}_RDF`;

    const db = mongoose.connection.db;

    // 선택된 필터 파싱
    const selected = {};
    for (const g of spec.groups) {
      const allKeys = [g.key, ...(g.aliases || [])];
      let vals = [];
      for (const k of allKeys) {
        vals = vals.concat(toArray(req.query[k]));
      }
      selected[g.key] = Array.from(new Set(vals.filter(Boolean)));
    }

    const qText = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * limit;
    const sortMode = req.query.sort || "recent";

    /* -------------------- match -------------------- */
    const match = { _class: klass };

    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), "i");
      const fields = spec.searchFields || ["_label", "title", "_description"];
      match.$or = fields.map((f) => ({ [f]: rx }));
    }

    // 필터 반영
    for (const g of spec.groups) {
      const vals = selected[g.key];
      if (vals && vals.length) {
        const allKeys = [g.key, ...(g.aliases || [])];
        match.$and = match.$and || [];
        match.$and.push({
          $or: allKeys.map((k) => ({ [k]: { $in: vals } })),
        });
      }
    }

    /* -------------------- 정렬 -------------------- */
    let sortStage;
    if (sortMode === "oldest") {
      sortStage = [
        {
          $addFields: {
            _s_date: { $ifNull: ["$datePosted", "$updatedAt"] },
          },
        },
        { $sort: { _s_date: 1, _id: 1 } },
      ];
    } else if (sortMode === "alpha-asc") {
      sortStage = [
        {
          $addFields: {
            _s_label: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", ""),
          },
        },
        { $sort: { _s_label: 1, _id: 1 } },
      ];
    } else if (sortMode === "alpha-desc") {
      sortStage = [
        {
          $addFields: {
            _s_label: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", ""),
          },
        },
        { $sort: { _s_label: -1, _id: -1 } },
      ];
    } else {
      // recent (default)
      sortStage = [
        {
          $addFields: {
            _s_date: { $ifNull: ["$datePosted", "$updatedAt"] },
          },
        },
        { $sort: { _s_date: -1, _id: -1 } },
      ];
    }

    const facetStages = {
      items: [
        ...sortStage,
        { $skip: skip },
        { $limit: limit },
        {
          $project: Object.assign(
            {
              _id: 1,
              "@id": 1,
              _label: 1,
              title: 1,
              _description: 1,
              description: 1,
              datePosted: 1,
              updatedAt: 1,
              createdAt: 1,
            },
            Object.fromEntries(
              spec.groups.flatMap((g) => {
                const base = [[g.key, 1]];
                const ali = (g.aliases || []).map((a) => [a, 1]);
                return base.concat(ali);
              })
            )
          ),
        },
      ],
      count: [{ $count: "total" }],
    };

    // Facet counts
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const arr = [];

      const allKeys = [g.key, ...(g.aliases || [])];
      arr.push({
        $set: {
          __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)),
        },
      });

      if (g.array) {
        arr.push({
          $set: {
            __facet_list__: {
              $cond: [
                { $isArray: "$__facet_value__" },
                "$__facet_value__",
                {
                  $cond: [
                    {
                      $gt: [
                        { $strLenCP: { $ifNull: ["$__facet_value__", ""] } },
                        0,
                      ],
                    },
                    ["$__facet_value__"],
                    [],
                  ],
                },
              ],
            },
          },
        });
        arr.push({
          $unwind: {
            path: "$__facet_list__",
            preserveNullAndEmptyArrays: false,
          },
        });
        arr.push({ $match: { __facet_list__: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$__facet_list__", c: { $sum: 1 } } });
      } else {
        arr.push({ $match: { __facet_value__: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$__facet_value__", c: { $sum: 1 } } });
      }

      arr.push({ $sort: { c: -1, _id: 1 } });
      arr.push({ $limit: 100 });

      facetStages[name] = arr;
    }

    const pipeline = [{ $match: match }, { $facet: facetStages }];
    const [agg] = await db.collection(coll).aggregate(pipeline).toArray();

    const items = (agg && agg.items) || [];
    const total = (agg && agg.count && agg.count[0] && agg.count[0].total) || 0;

    // Facets for filters
    const facets = {};
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      facets[g.key] = {
        label: g.label,
        options: ((agg && agg[name]) || [])
          .filter((x) => x._id)
          .map((x) => ({ value: x._id, count: x.c })),
      };
    }

    // Return JSON
    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      facets,
      query: qText,
      selected,
    });
  } catch (e) {
    console.error("[MOBILE API] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
