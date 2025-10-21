// router/stripe.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
require("dotenv").config();

const { requireLogin } = require("../middleware/auth");
const User = require("../model/user");
const resumePriceConfig = require("../config/resumePriceConfig");
const tutorPriceConfig = require("../config/tutorPriceConfig");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const validateObjectId = require("../middleware/validateObjectId");
router.param("id", validateObjectId("id"));

/* -------------------------------------------------------------
   GET /stripe/checkout  (Unified entry)
   - Employer Ads   : (기본) 옵션 목록
   - Resume (Seeker): ?accessPeriod=30 → resume checkout (선택 사전 지정)
   - Tutor          : ?type=tutor&accessPeriod=30 → tutor checkout
------------------------------------------------------------- */
router.get("/checkout", requireLogin, (req, res) => {
  const { type, accessPeriod } = req.query;

  // TUTOR
  if (type === "tutor") {
    const days = parseInt(accessPeriod, 10);
    if (![30, 90, 365].includes(days)) {
      return res.status(400).send("❌ Invalid tutor visibility period");
    }
    const selected =
      tutorPriceConfig.find((p) => Number(p.days ?? p.id) === days) || null;
    const label =
      (selected && selected.label) ||
      "Tutor Listing Visibility — " + days + " Days";
    const price = selected && selected.price;

    return res.render("stripe/checkout_tutor", {
      user: req.user,
      days,
      price,
      label,
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
    });
  }

  // RESUME (back-compat quick start via ?accessPeriod=XX)
  if (accessPeriod) {
    const preselectDays = parseInt(accessPeriod, 10);
    const packages = resumePriceConfig.map((p) => ({
      value: p.id, // planId
      label: p.label,
      price: p.price,
      days: p.days,
    }));
    return res.render("stripe/checkout_resume", {
      user: req.user,
      packages,
      preselectDays,
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
    });
  }

  // EMPLOYER Job Ads (default)
  const packages = [
    { value: "1", label: "1 Ad — $30", price: 30 },
    { value: "4", label: "4 Ads — $100 (Save $20)", price: 100 },
    { value: "12", label: "12 Ads — $250 (Save $110)", price: 250 },
    { value: "24", label: "24 Ads — $450 (Save $270)", price: 450 },
  ];
  return res.render("stripe/checkout", {
    user: req.user,
    packages,
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
  });
});

/* -------------------------------------------------------------
   GET /stripe/checkout-resume  (Legacy entry kept)
------------------------------------------------------------- */
router.get("/checkout-resume", requireLogin, (req, res) => {
  const packages = resumePriceConfig.map((p) => ({
    value: p.id, // planId
    label: p.label,
    price: p.price,
    days: p.days,
  }));
  res.render("stripe/checkout_resume", {
    user: req.user,
    packages,
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
  });
});

/* -------------------------------------------------------------
   POST /stripe/create-checkout-session
   - Resume: planId (권장) 또는 resumeDays(숫자) 둘 다 수용
   - Employer: adPackage
   - Tutor: tutorDays
------------------------------------------------------------- */
router.post("/create-checkout-session", requireLogin, async (req, res) => {
  try {
    const { planId, resumeDays, adPackage, tutorDays } = req.body;
    console.log("create-checkout-session body", req.body);

    let lineItems = [];
    let metadata = {};
    let successUrl = "";
    let cancelUrl = `${process.env.BASE_URL}/stripe/checkout`;

    // RESUME (by planId)
    if (planId) {
      const selected = resumePriceConfig.find((p) => p.id === planId);
      if (!selected)
        return res.status(400).json({ error: "Invalid resume plan" });
      
      metadata = { type: "resume", planId: planId };
      successUrl = `${process.env.BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: {
            name: selected.label,
            description: `Resume visibility for ${selected.id} days`,
          },
          unit_amount: selected.price * 100, // Stripe uses cents
        },
        quantity: 1,
      }];
    }
    // RESUME (by resumeDays)
    else if (resumeDays) {
      const days = parseInt(resumeDays, 10);
      const selected = resumePriceConfig.find((p) => Number(p.days ?? p.id) === days.toString());
      if (!selected)
        return res.status(400).json({ error: "Invalid resume plan (days)" });
      
      metadata = { type: "resume", resumeDays: days };
      successUrl = `${process.env.BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: {
            name: selected.label || `Resume Visibility — ${days} Days`,
            description: `Resume visibility for ${days} days`,
          },
          unit_amount: selected.price * 100,
        },
        quantity: 1,
      }];
    }
    // EMPLOYER ADS
    else if (adPackage) {
      const prices = { 1: 30, 4: 100, 12: 250, 24: 450 };
      const price = prices[adPackage] || 30;
      
      metadata = { type: "employer", adPackage: adPackage };
      successUrl = `${process.env.BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${adPackage} Job Vacancy Ads`,
            description: `Purchase ${adPackage} job posting credits`,
          },
          unit_amount: price * 100,
        },
        quantity: 1,
      }];
    }
    // TUTOR
    else if (tutorDays) {
      const days = parseInt(tutorDays, 10);
      const selected = tutorPriceConfig.find(
        (p) => Number(p.days ?? p.id) === days
      );
      if (!selected)
        return res.status(400).json({ error: "Invalid tutor plan" });
      
      metadata = { type: "tutor", tutorDays: days };
      successUrl = `${process.env.BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: {
            name: selected.label || `Tutor Listing Visibility — ${days} Days`,
            description: `Tutor profile visibility for ${days} days`,
          },
          unit_amount: selected.price * 100,
        },
        quantity: 1,
      }];
    } else {
      return res.status(400).json({ error: "No valid purchase data" });
    }

    // Add user ID to metadata
    const uid =
      (req.user && req.user._id) ||
      (req.session.user && req.session.user._id) ||
      req.session.userId;
    if (!uid) return res.status(401).json({ error: "No user in session" });
    
    metadata.userId = uid.toString();

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
      customer_email: req.user.email,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error(
      "❌ create-checkout-session error:",
      error.message
    );
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/* -------------------------------------------------------------
   GET /stripe/success
   - 결제 성공 후 리다이렉트 페이지
------------------------------------------------------------- */
router.get("/success", requireLogin, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.redirect("/user/mypage");
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== "paid") {
      req.flash("error", "Payment not completed");
      return res.redirect("/user/mypage");
    }

    // Get metadata
    const metadata = session.metadata;
    const uid = metadata.userId;

    if (!uid) {
      req.flash("error", "User ID not found in payment session");
      return res.redirect("/user/mypage");
    }

    // Update user based on payment type
    if (metadata.type === "employer") {
      const count = parseInt(metadata.adPackage, 10);
      await User.findByIdAndUpdate(uid, { $inc: { adsAvailable: count } });
      req.flash("success", `✅ Payment successful! ${count} ad credits added.`);
      return res.redirect("/job-vacancies/new_paid_user");
    }

    if (metadata.type === "resume") {
      const days = parseInt(metadata.planId || metadata.resumeDays, 10);
      await User.findByIdAndUpdate(uid, {
        resumeAccess: { startDate: new Date(), durationDays: days },
      });
      req.flash("success", `✅ Payment successful! Resume access activated for ${days} days.`);
      return res.redirect("/user/mypage-jobseeker");
    }

    if (metadata.type === "tutor") {
      const days = parseInt(metadata.tutorDays, 10);
      await User.findByIdAndUpdate(uid, {
        tutorAccess: { startDate: new Date(), durationDays: days },
      });
      req.flash("success", `✅ Payment successful! Tutor listing activated for ${days} days.`);
      return res.redirect("/user/mypage-tutor");
    }

    req.flash("error", "Invalid payment type");
    return res.redirect("/user/mypage");
  } catch (error) {
    console.error("❌ success handler error:", error.message);
    req.flash("error", "Failed to process payment");
    res.redirect("/user/mypage");
  }
});

/* -------------------------------------------------------------
   POST /stripe/webhook
   - Stripe webhook for payment verification (optional but recommended)
------------------------------------------------------------- */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ Payment succeeded:", session.id);
    
    // Additional processing can be done here
    // The main fulfillment is already handled in the success route
  }

  res.json({ received: true });
});

module.exports = router;
