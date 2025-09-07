// router/portone.js
"use strict";
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { requireLogin } = require("../middleware/auth");
const User = require("../model/user");

// ✅ add: parse urlencoded & JSON bodies (FormData는 안 쓰게 바꿀 거지만 방어용)
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

const PORTONE_MERCHANT_ID = process.env.PORTONE_MERCHANT_ID || "imp10391932";
const PORTONE_API_KEY = process.env.PORTONE_API_KEY || "";
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || "";

const USD2KRW = 1350;

async function getIamportToken() {
  const { data } = await axios.post("https://api.iamport.kr/users/getToken", {
    imp_key: PORTONE_API_KEY,
    imp_secret: PORTONE_API_SECRET,
  });
  if (data?.code !== 0) throw new Error(data?.message || "PortOne token error");
  return data.response.access_token;
}

router.post("/ready", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user?._id).lean();
    if (!user) return res.json({ ok: false, message: "User not found" });

    // ✅ body 방어
    const body = req.body || {};
    const item = String((body.item || "employer_plan")).trim();

    let merchant_uid, name, amount;

    if (item === "employer_plan") {
      const pkg = parseInt(body.package || "1", 10);
      const priceUSDMap = { 1: 30, 4: 100, 12: 250, 24: 450 };
      const priceUSD = priceUSDMap[pkg] || 30;
      amount = priceUSD * USD2KRW;
      merchant_uid = `esl_employer_${pkg}ads_${Date.now()}`;
      name = `${pkg} 광고 등록권`;

      req.session.lastOrder = {
        merchant_uid, amount, item, pkg, userId: String(user._id),
      };
    } else if (item === "resume_access" || item === "tutor_visibility") {
      const period = parseInt(body.period || "30", 10);
      const priceMap = { 30: 49000, 90: 129000, 365: 399000 };
      amount = priceMap[period] || 49000;
      merchant_uid = `esl_${item}_${period}d_${Date.now()}`;
      name = `${item} (${period}일)`;

      req.session.lastOrder = {
        merchant_uid, amount, item, period, userId: String(user._id),
      };
    } else {
      return res.status(400).json({ ok: false, message: "Invalid item type" });
    }

    return res.json({
      ok: true, merchant_uid, name, amount,
      buyer: { email: user.email, name: user.username, tel: user.phone || "" },
      merchant_id: PORTONE_MERCHANT_ID,
    });
  } catch (e) {
    console.error("[portone.ready]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/complete", requireLogin, async (req, res) => {
  try {
    const { imp_uid, merchant_uid } = req.body || {};
    if (!imp_uid || !merchant_uid) return res.status(400).json({ ok: false, message: "Missing params" });

    const expects = req.session.lastOrder;
    if (!expects || expects.merchant_uid !== merchant_uid) throw new Error("Order not found/mismatch");

    const token = await getIamportToken();
    const { data } = await axios.get(`https://api.iamport.kr/payments/${imp_uid}`, {
      headers: { Authorization: token },
    });
    if (data?.code !== 0) throw new Error(data?.message || "Payment fetch error");

    const pay = data.response;
    if (+pay.amount !== +expects.amount) throw new Error("Amount mismatch");
    if (pay.status !== "paid") throw new Error("Not paid");

    const user = await User.findById(expects.userId);
    if (!user) throw new Error("User not found");

    if (expects.item === "employer_plan") {
      user.adsAvailable = (+user.adsAvailable || 0) + (expects.pkg || 1);
    } else if (expects.item === "resume_access") {
      user.resumeAccess = { startDate: new Date(), durationDays: expects.period };
    } else if (expects.item === "tutor_visibility") {
      user.tutorAccess = { startDate: new Date(), durationDays: expects.period };
    }
    await user.save();

    return res.json({ ok: true });
  } catch (e) {
    console.error("[portone.complete]", e);
    return res.status(500).json({ ok: false, message: e.message });
  }
});

router.post("/webhook", (req, res) => res.status(200).send("OK"));
module.exports = router;
