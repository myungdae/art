// router/paddle.js - Paddle 결제 시스템
const express = require("express");
const router = express.Router();
require("dotenv").config();

const { requireLogin } = require("../middleware/auth");
const User = require("../model/user");
const priceConfig = require("../config/priceConfig");
const resumePriceConfig = require("../config/resumePriceConfig");
const tutorPriceConfig = require("../config/tutorPriceConfig");

/* -------------------------------------------------------------
   GET /paddle/checkout
   - Employer Ads (기본) 또는 쿼리로 타입 지정
   - ?type=resume&accessPeriod=30
   - ?type=tutor&accessPeriod=30
------------------------------------------------------------- */
router.get("/checkout", requireLogin, (req, res) => {
  const { type, accessPeriod } = req.query;

  // TUTOR
  if (type === "tutor") {
    const days = parseInt(accessPeriod, 10);
    if (![30, 90, 365].includes(days)) {
      return res.status(400).send("❌ Invalid tutor visibility period");
    }
    const selected = tutorPriceConfig.find((p) => p.id === String(days));
    
    return res.render("paddle/checkout_tutor", {
      user: req.user,
      days,
      price: selected ? selected.price : 0,
      label: selected ? selected.label : `Tutor Listing - ${days} Days`,
      paddleEnvironment: process.env.PADDLE_ENVIRONMENT || "sandbox",
    });
  }

  // RESUME
  if (type === "resume" || accessPeriod) {
    const preselectDays = parseInt(accessPeriod, 10);
    const packages = resumePriceConfig.map((p) => ({
      value: p.id,
      label: p.label,
      price: p.price,
      days: p.id,
    }));
    
    return res.render("paddle/checkout_resume", {
      user: req.user,
      packages,
      preselectDays,
      paddleEnvironment: process.env.PADDLE_ENVIRONMENT || "sandbox",
    });
  }

  // EMPLOYER Job Ads (default)
  const packages = priceConfig.map((p) => ({
    value: p.id,
    label: p.label,
    price: p.price,
    discount: p.discount || 0,
  }));
  
  return res.render("paddle/checkout", {
    user: req.user,
    packages,
    paddleEnvironment: process.env.PADDLE_ENVIRONMENT || "sandbox",
  });
});

/* -------------------------------------------------------------
   POST /paddle/webhook
   - Paddle webhook endpoint for payment notifications
------------------------------------------------------------- */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    
    // Paddle webhook verification
    // Note: Paddle uses signature verification
    const signature = req.headers["paddle-signature"];
    
    if (!signature) {
      console.error("❌ Missing Paddle signature");
      return res.status(400).send("Missing signature");
    }

    // Parse webhook payload
    const event = req.body;
    
    console.log("🔔 Paddle Webhook Event:", event.event_type);

    // Handle transaction.completed event
    if (event.event_type === "transaction.completed") {
      const customData = event.data.custom_data || {};
      const userId = customData.userId;
      const type = customData.type;

      if (!userId) {
        console.error("❌ No userId in webhook data");
        return res.status(400).send("Missing userId");
      }

      // Update user based on payment type
      if (type === "employer") {
        const count = parseInt(customData.adPackage, 10);
        await User.findByIdAndUpdate(userId, { $inc: { adsAvailable: count } });
        console.log(`✅ Added ${count} ad credits to user ${userId}`);
      } else if (type === "resume") {
        const days = parseInt(customData.resumeDays || customData.accessPeriod, 10);
        await User.findByIdAndUpdate(userId, {
          resumeAccess: { startDate: new Date(), durationDays: days },
        });
        console.log(`✅ Activated resume access for ${days} days for user ${userId}`);
      } else if (type === "tutor") {
        const days = parseInt(customData.tutorDays || customData.accessPeriod, 10);
        await User.findByIdAndUpdate(userId, {
          tutorAccess: { startDate: new Date(), durationDays: days },
        });
        console.log(`✅ Activated tutor listing for ${days} days for user ${userId}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ Paddle webhook error:", error.message);
    res.status(500).send("Webhook processing failed");
  }
});

/* -------------------------------------------------------------
   GET /paddle/success
   - 결제 성공 후 리다이렉트 페이지
------------------------------------------------------------- */
router.get("/success", requireLogin, async (req, res) => {
  const { type } = req.query;

  // Redirect to appropriate page based on payment type
  if (type === "employer") {
    req.flash("success", "✅ Payment successful! Your ad credits have been added.");
    return res.redirect("/job-vacancies/new_paid_user");
  } else if (type === "resume") {
    req.flash("success", "✅ Payment successful! Your resume access has been activated.");
    return res.redirect("/user/mypage-jobseeker");
  } else if (type === "tutor") {
    req.flash("success", "✅ Payment successful! Your tutor listing has been activated.");
    return res.redirect("/user/mypage-tutor");
  }

  req.flash("success", "✅ Payment completed successfully!");
  return res.redirect("/user/mypage");
});

module.exports = router;
