// router/portone.js - PortOne (Eximbay) 결제 시스템
const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();

const { requireLogin } = require("../middleware/auth");
const User = require("../model/user");
const priceConfig = require("../config/priceConfig");
const resumePriceConfig = require("../config/resumePriceConfig");
const tutorPriceConfig = require("../config/tutorPriceConfig");

/* -------------------------------------------------------------
   GET /portone/checkout
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
    
    return res.render("portone/checkout_tutor", {
      user: req.user,
      days,
      price: selected ? selected.price : 0,
      label: selected ? selected.label : `Tutor Listing - ${days} Days`,
      channelKey: process.env.PORTONE_CHANNEL_KEY,
      storeId: process.env.PORTONE_STORE_ID,
      testMode: process.env.PORTONE_TEST_MODE === "true",
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
    
    return res.render("portone/checkout_resume", {
      user: req.user,
      packages,
      preselectDays,
      channelKey: process.env.PORTONE_CHANNEL_KEY,
      storeId: process.env.PORTONE_STORE_ID,
      testMode: process.env.PORTONE_TEST_MODE === "true",
    });
  }

  // EMPLOYER Job Ads (default)
  const packages = priceConfig.map((p) => ({
    value: p.id,
    label: p.label,
    price: p.price,
    discount: p.discount || 0,
  }));
  
  return res.render("portone/checkout", {
    user: req.user,
    packages,
    channelKey: process.env.PORTONE_CHANNEL_KEY,
    storeId: process.env.PORTONE_STORE_ID,
    testMode: process.env.PORTONE_TEST_MODE === "true",
  });
});

/* -------------------------------------------------------------
   POST /portone/webhook
   - PortOne webhook endpoint for payment notifications
------------------------------------------------------------- */
router.post("/webhook", express.json(), async (req, res) => {
  try {
    const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
    
    // PortOne webhook 서명 검증
    const signature = req.headers["portone-signature"];
    
    if (!signature) {
      console.error("❌ Missing PortOne signature");
      return res.status(400).send("Missing signature");
    }

    // Webhook 데이터 파싱
    const event = req.body;
    
    console.log("🔔 PortOne Webhook Event:", event.type || event.status);

    // 결제 완료 이벤트 처리
    if (event.status === "paid" || event.type === "Transaction.Paid") {
      const paymentId = event.payment_id || event.paymentId || event.merchant_uid || event.merchantUid;
      
      // paymentId 형식: employer_{packageId}_{userId}_timestamp 또는 resume_{days}d_{userId}_timestamp
      console.log("🔍 PaymentId:", paymentId);
      
      if (!paymentId) {
        console.error("❌ No paymentId in webhook data");
        return res.status(400).send("Missing paymentId");
      }

      // paymentId에서 정보 추출
      const parts = paymentId.split('_');
      const type = parts[0]; // employer, resume, tutor
      
      if (!type || parts.length < 3) {
        console.error("❌ Invalid paymentId format:", paymentId);
        return res.status(400).send("Invalid paymentId format");
      }

      // userId 추출 (뒤에서 두 번째 부분)
      const userIdPart = parts[parts.length - 2];
      
      // MongoDB ObjectId는 24자리이므로, 앞 8자리로 사용자 찾기
      const user = await User.findOne({ 
        _id: { $regex: `^${userIdPart}` } 
      });

      if (!user) {
        console.error("❌ User not found for paymentId:", paymentId);
        return res.status(404).send("User not found");
      }

      // 결제 타입별 처리
      if (type === "employer") {
        const packageId = parts[1]; // 1, 4, 12, 24
        const count = parseInt(packageId, 10);
        await User.findByIdAndUpdate(user._id, { $inc: { adsAvailable: count } });
        console.log(`✅ Added ${count} ad credits to user ${user._id}`);
      } else if (type === "resume") {
        const daysStr = parts[1]; // "30d", "90d", "365d"
        const days = parseInt(daysStr.replace('d', ''), 10);
        await User.findByIdAndUpdate(user._id, {
          resumeAccess: { startDate: new Date(), durationDays: days },
        });
        console.log(`✅ Activated resume access for ${days} days for user ${user._id}`);
      } else if (type === "tutor") {
        const daysStr = parts[1]; // "30d", "90d", "365d"
        const days = parseInt(daysStr.replace('d', ''), 10);
        await User.findByIdAndUpdate(user._id, {
          tutorAccess: { startDate: new Date(), durationDays: days },
        });
        console.log(`✅ Activated tutor listing for ${days} days for user ${user._id}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ PortOne webhook error:", error.message);
    res.status(500).send("Webhook processing failed");
  }
});

/* -------------------------------------------------------------
   POST /portone/verify
   - 서버측 결제 검증 (클라이언트 결제 후 호출)
------------------------------------------------------------- */
router.post("/verify", requireLogin, async (req, res) => {
  try {
    const { imp_uid, merchant_uid } = req.body;

    if (!imp_uid || !merchant_uid) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required parameters" 
      });
    }

    // PortOne API로 결제 정보 조회
    const apiSecret = process.env.PORTONE_API_SECRET;
    const storeId = process.env.PORTONE_STORE_ID;

    // Access Token 발급
    const tokenResponse = await axios.post(
      "https://api.portone.io/login/api-secret",
      {
        api_secret: apiSecret,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 결제 정보 조회
    const paymentResponse = await axios.get(
      `https://api.portone.io/payments/${imp_uid}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payment = paymentResponse.data;

    // 결제 상태 확인
    if (payment.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    // 주문 정보와 일치 확인
    if (payment.merchant_uid !== merchant_uid) {
      return res.status(400).json({
        success: false,
        message: "Order mismatch",
      });
    }

    // 성공 응답
    return res.json({
      success: true,
      payment,
    });

  } catch (error) {
    console.error("❌ Payment verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
      error: error.message,
    });
  }
});

/* -------------------------------------------------------------
   GET /portone/success
   - 결제 성공 후 리다이렉트 페이지
------------------------------------------------------------- */
router.get("/success", requireLogin, async (req, res) => {
  const { type } = req.query;

  // 타입별 리다이렉트
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

/* -------------------------------------------------------------
   GET /portone/cancel
   - 결제 취소 페이지
------------------------------------------------------------- */
router.get("/cancel", requireLogin, (req, res) => {
  const { type } = req.query;
  
  req.flash("error", "Payment was cancelled.");
  
  if (type === "employer") {
    return res.redirect("/job-vacancies/new_paid_user");
  } else if (type === "resume") {
    return res.redirect("/user/mypage-jobseeker");
  } else if (type === "tutor") {
    return res.redirect("/user/mypage-tutor");
  }
  
  return res.redirect("/user/mypage");
});

module.exports = router;
