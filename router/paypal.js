// router/paypal.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();

const { requireLogin } = require("../middleware/auth");
const User = require("../model/user");
const resumePriceConfig = require("../config/resumePriceConfig");
const tutorPriceConfig = require("../config/tutorPriceConfig");

const PAYPAL_API = process.env.PAYPAL_API;
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;

const validateObjectId = require("../middleware/validateObjectId");
router.param("id", validateObjectId("id"));

// ─────────────────────────────────────────────────────────
// Common price maps
// ─────────────────────────────────────────────────────────
const EMPLOYER_PACKAGES = [
  { value: "1",  label: "1 Ad — $30",                     price: 30 },
  { value: "4",  label: "4 Ads — $100 (Save $20)",        price: 100 },
  { value: "12", label: "12 Ads — $250 (Save $110)",      price: 250 },
  { value: "24", label: "24 Ads — $450 (Save $270)",      price: 450 },
];
const EMPLOYER_PRICE_MAP = EMPLOYER_PACKAGES.reduce((m, p) => { m[p.value] = p.price; return m; }, {});

// --- PayPal Access Token ---
async function getAccessToken() {
  const auth = Buffer.from(CLIENT_ID + ":" + SECRET).toString("base64");
  const res = await axios.post(
    PAYPAL_API + "/v1/oauth2/token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return res.data.access_token;
}

/* -------------------------------------------------------------
   GET /paypal/checkout  (Unified entry)
   - Employer Ads   : (기본) 옵션 목록, ?pkg=1|4|12|24 프리셀렉트
   - Resume (Seeker): ?accessPeriod=30 → resume checkout
   - Tutor          : ?type=tutor&accessPeriod=30 → tutor checkout
------------------------------------------------------------- */
router.get("/checkout", requireLogin, (req, res) => {
  const { type, accessPeriod, pkg } = req.query;

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

    return res.render("paypal/checkout_tutor", {
      user: req.user,
      days,
      price,
      label,
      paypalClientId: process.env.PAYPAL_CLIENT_ID,
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
    return res.render("paypal/checkout_resume", {
      user: req.user,
      packages,
      preselectDays,
      paypalClientId: process.env.PAYPAL_CLIENT_ID,
    });
  }

  // EMPLOYER Job Ads (default)
  const preselectPkg = (pkg && ["1","4","12","24"].includes(pkg)) ? pkg : null;
  return res.render("paypal/checkout", {
    user: req.user,
    packages: EMPLOYER_PACKAGES,
    preselectPkg, // 뷰에서 미리 선택 표시용
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
  });
});

/* -------------------------------------------------------------
   Aliases for employer credits (mounted under /paypal)
   /paypal/credits, /paypal/billing/credits, /paypal/checkout-ads
   → 모두 /paypal/checkout 로 보냄 (pkg 프리셀렉트 유지)
------------------------------------------------------------- */
router.get(["/credits", "/billing/credits", "/checkout-ads"], requireLogin, (req, res) => {
  const qs = [];
  if (req.query.pkg && ["1","4","12","24"].includes(String(req.query.pkg))) {
    qs.push("pkg=" + encodeURIComponent(String(req.query.pkg)));
  }
  const suffix = qs.length ? ("?" + qs.join("&")) : "";
  return res.redirect(302, "/paypal/checkout" + suffix);
});

/* -------------------------------------------------------------
   GET /paypal/checkout-resume  (Legacy entry kept)
------------------------------------------------------------- */
router.get("/checkout-resume", requireLogin, (req, res) => {
  const packages = resumePriceConfig.map((p) => ({
    value: p.id, // planId
    label: p.label,
    price: p.price,
    days: p.days,
  }));
  res.render("paypal/checkout_resume", {
    user: req.user,
    packages,
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
  });
});

/* -------------------------------------------------------------
   POST /paypal/create-order
   - Resume: planId (권장) 또는 resumeDays(숫자) 둘 다 수용
   - Employer: adPackage
   - Tutor: tutorDays
------------------------------------------------------------- */
router.post("/create-order", requireLogin, async (req, res) => {
  try {
    const { planId, resumeDays, adPackage, tutorDays } = req.body;
    console.log("create-order body", req.body);

    let purchaseUnit = null;

    // RESUME (by planId)
    if (planId) {
      const selected = resumePriceConfig.find((p) => p.id === planId);
      if (!selected)
        return res.status(400).json({ error: "Invalid resume plan" });
      req.session.resumePlan = planId;
      purchaseUnit = {
        amount: { currency_code: "USD", value: selected.price.toFixed(2) },
        description: selected.label,
      };
    }
    // RESUME (by resumeDays)
    else if (resumeDays) {
      const days = parseInt(resumeDays, 10);
      const selected = resumePriceConfig.find((p) => Number(p.days) === days);
      if (!selected)
        return res.status(400).json({ error: "Invalid resume plan (days)" });
      req.session.resumeDays = days;
      purchaseUnit = {
        amount: { currency_code: "USD", value: selected.price.toFixed(2) },
        description: selected.label || "Resume Visibility — " + days + " Days",
      };
    }
    // EMPLOYER ADS
    else if (adPackage) {
      const price = EMPLOYER_PRICE_MAP[adPackage] ?? 30;
      purchaseUnit = {
        amount: { currency_code: "USD", value: Number(price).toFixed(2) },
        description: adPackage + " Job Vacancy Ads",
      };
      req.session.adPackage = adPackage;
    }
    // TUTOR
    else if (tutorDays) {
      const days = parseInt(tutorDays, 10);
      const selected = tutorPriceConfig.find(
        (p) => Number(p.days ?? p.id) === days
      );
      if (!selected)
        return res.status(400).json({ error: "Invalid tutor plan" });
      req.session.tutorDays = days;
      purchaseUnit = {
        amount: { currency_code: "USD", value: selected.price.toFixed(2) },
        description:
          selected.label || "Tutor Listing Visibility — " + days + " Days",
      };
    } else {
      return res.status(400).json({ error: "No valid purchase data" });
    }

    // Create PayPal Order
    const accessToken = await getAccessToken();
    const order = await axios.post(
      PAYPAL_API + "/v2/checkout/orders",
      { intent: "CAPTURE", purchase_units: [purchaseUnit] },
      {
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ id: order.data.id });
  } catch (error) {
    console.error("❌ create-order error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/* -------------------------------------------------------------
   POST /paypal/capture-order/:orderID
   - 결제 성공 시 각 케이스별로 DB 갱신 후 적절한 리다이렉트
------------------------------------------------------------- */
router.post("/capture-order/:orderID", requireLogin, async (req, res) => {
  try {
    const orderID = req.params.orderID;
    const accessToken = await getAccessToken();

    await axios.post(
      PAYPAL_API + "/v2/checkout/orders/" + orderID + "/capture",
      {},
      {
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    // 현재 로그인 사용자 ID 추출
    const uid =
      (req.user && req.user._id) ||
      (req.session.user && req.session.user._id) ||
      req.session.userId;
    if (!uid) return res.status(401).json({ error: "No user in session" });

    // EMPLOYER ADS
    if (req.session.adPackage) {
      const count = parseInt(req.session.adPackage, 10);
      await User.findByIdAndUpdate(uid, { $inc: { adsAvailable: count } });
      delete req.session.adPackage;
      return res.json({ status: "redirect", url: "/job-vacancies/new_paid_user" });
    }

    // RESUME VISIBILITY (by planId)
    if (req.session.resumePlan) {
      const selected = resumePriceConfig.find((p) => p.id === req.session.resumePlan);
      if (selected) {
        await User.findByIdAndUpdate(uid, {
          resumeAccess: { startDate: new Date(), durationDays: selected.days },
        });
      }
      delete req.session.resumePlan;
      return res.json({ status: "redirect", url: "/user/mypage-jobseeker" });
    }

    // RESUME VISIBILITY (by resumeDays)
    if (req.session.resumeDays) {
      const days = parseInt(req.session.resumeDays, 10);
      await User.findByIdAndUpdate(uid, {
        resumeAccess: { startDate: new Date(), durationDays: days },
      });
      delete req.session.resumeDays;
      return res.json({ status: "redirect", url: "/user/mypage-jobseeker" });
    }

    // TUTOR LISTING VISIBILITY
    if (req.session.tutorDays) {
      const days = parseInt(req.session.tutorDays, 10);
      await User.findByIdAndUpdate(uid, {
        tutorAccess: { startDate: new Date(), durationDays: days },
      });
      delete req.session.tutorDays;
      return res.json({ status: "redirect", url: "/user/mypage-tutor" });
    }

    return res.status(400).json({ error: "Invalid payment context" });
  } catch (error) {
    console.error("❌ capture-order error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

module.exports = router;
