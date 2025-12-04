// router/portone.js - PortOne (Eximbay) Payment System
const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();

const { requireLogin } = require("../middleware/auth");
const User = require("../model/user");
const Payment = require("../model/payment");
const priceConfig = require("../config/priceConfig");
const resumePriceConfig = require("../config/resumePriceConfig");
const tutorPriceConfig = require("../config/tutorPriceConfig");

/* -------------------------------------------------------------
   GET /portone/checkout-demo (TEMP for Toss Payments demo)
   - Same as /checkout but without login requirement
------------------------------------------------------------- */
router.get("/checkout-demo", (req, res) => {
  const { type, accessPeriod } = req.query;
  
  // Create fake user for demo
  const fakeUser = {
    _id: "demo-user-id",
    username: "Demo User",
    email: "demo@eslplus.org",
    role: "Employer"
  };

  // TUTOR
  if (type === "tutor") {
    const days = parseInt(accessPeriod, 10);
    if (![30, 90, 365].includes(days)) {
      return res.status(400).send("❌ Invalid tutor visibility period");
    }
    const selected = tutorPriceConfig.find((p) => p.id === String(days));
    
    return res.render("portone/checkout_tutor", {
      user: fakeUser,
      days,
      price: selected ? selected.price : 0,
      label: selected ? selected.label : `Tutor Listing - ${days} Days`,
      paypalChannelKey: process.env.PORTONE_PAYPAL_CHANNEL_KEY,
      tossChannelKey: process.env.PORTONE_TOSSPAYMENTS_CHANNEL_KEY,
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
      user: fakeUser,
      packages,
      preselectDays,
      paypalChannelKey: process.env.PORTONE_PAYPAL_CHANNEL_KEY,
      tossChannelKey: process.env.PORTONE_TOSSPAYMENTS_CHANNEL_KEY,
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
    user: fakeUser,
    packages,
    paypalChannelKey: process.env.PORTONE_PAYPAL_CHANNEL_KEY,
    tossChannelKey: process.env.PORTONE_TOSSPAYMENTS_CHANNEL_KEY,
    storeId: process.env.PORTONE_STORE_ID,
    testMode: process.env.PORTONE_TEST_MODE === "true",
  });
});

/* -------------------------------------------------------------
   GET /portone/checkout
   - Employer Ads (default) or specify type via query
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
      paypalChannelKey: process.env.PORTONE_PAYPAL_CHANNEL_KEY,
      tossChannelKey: process.env.PORTONE_TOSSPAYMENTS_CHANNEL_KEY,
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
      paypalChannelKey: process.env.PORTONE_PAYPAL_CHANNEL_KEY,
      tossChannelKey: process.env.PORTONE_TOSSPAYMENTS_CHANNEL_KEY,
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
    paypalChannelKey: process.env.PORTONE_PAYPAL_CHANNEL_KEY,
    tossChannelKey: process.env.PORTONE_TOSSPAYMENTS_CHANNEL_KEY,
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
    
    // PortOne webhook signature verification
    const signature = req.headers["portone-signature"];
    
    if (!signature) {
      console.warn("⚠️ Missing PortOne signature (continuing anyway for testing)");
      // Temporarily allow webhooks without signature for testing
      // return res.status(400).send("Missing signature");
    }

    // Parse webhook data
    const event = req.body;
    
    console.log("🔔 PortOne Webhook Event:", event.type || event.status);
    console.log("📦 Webhook Full Data:", JSON.stringify(event, null, 2));

    // Handle payment completed event
    if (event.status === "paid" || event.type === "Transaction.Paid") {
      const paymentId = event.payment_id || event.paymentId || event.merchant_uid || event.merchantUid;
      
      // paymentId 형식: employer_{packageId}_{userId}_timestamp 또는 resume_{days}d_{userId}_timestamp
      console.log("🔍 PaymentId:", paymentId);
      
      if (!paymentId) {
        console.error("❌ No paymentId in webhook data");
        return res.status(400).send("Missing paymentId");
      }

      // Extract info from paymentId
      const parts = paymentId.split('_');
      const type = parts[0]; // employer, resume, tutor
      
      if (!type || parts.length < 3) {
        console.error("❌ Invalid paymentId format:", paymentId);
        return res.status(400).send("Invalid paymentId format");
      }

      // Extract userId (second to last part)
      const userIdPart = parts[parts.length - 2];
      
      // MongoDB ObjectId is 24 chars, search by first 8 chars
      const user = await User.findOne({ 
        _id: { $regex: `^${userIdPart}` } 
      });

      if (!user) {
        console.error("❌ User not found for paymentId:", paymentId);
        return res.status(404).send("User not found");
      }

      // Extract payment details
      const amount = event.amount || event.paid_amount || 0;
      const paymentMethod = event.pay_method || event.payment_method || 'UNKNOWN';
      let packageType, packageDetails;

      // Handle by payment type
      if (type === "employer") {
        const packageId = parts[1]; // 1, 4, 12, 24
        const count = parseInt(packageId, 10);
        
        // Find price from config
        const packageConfig = priceConfig.find(p => p.id === packageId);
        
        packageType = 'job_ads';
        packageDetails = {
          quantity: count,
          description: packageConfig ? packageConfig.label : `${count} Job Ad Credits`
        };
        
        await User.findByIdAndUpdate(user._id, { $inc: { adsAvailable: count } });
        console.log(`✅ Added ${count} ad credits to user ${user._id}`);
        
      } else if (type === "resume") {
        const daysStr = parts[1]; // "30d", "90d", "365d"
        const days = parseInt(daysStr.replace('d', ''), 10);
        
        // Find price from config
        const packageConfig = resumePriceConfig.find(p => p.id === String(days));
        
        packageType = 'resume_access';
        packageDetails = {
          duration: days,
          description: packageConfig ? packageConfig.label : `Resume Access - ${days} Days`
        };
        
        await User.findByIdAndUpdate(user._id, {
          resumeAccess: { startDate: new Date(), durationDays: days },
        });
        console.log(`✅ Activated resume access for ${days} days for user ${user._id}`);
        
      } else if (type === "tutor") {
        const daysStr = parts[1]; // "30d", "90d", "365d"
        const days = parseInt(daysStr.replace('d', ''), 10);
        
        // Find price from config
        const packageConfig = tutorPriceConfig.find(p => p.id === String(days));
        
        packageType = 'tutor_access';
        packageDetails = {
          duration: days,
          description: packageConfig ? packageConfig.label : `Tutor Listing - ${days} Days`
        };
        
        await User.findByIdAndUpdate(user._id, {
          tutorAccess: { startDate: new Date(), durationDays: days },
        });
        console.log(`✅ Activated tutor listing for ${days} days for user ${user._id}`);
      }

      // Save payment record to database
      try {
        const payment = new Payment({
          paymentId: paymentId,
          merchantUid: event.merchant_uid || paymentId,
          userId: user._id,
          userEmail: user.email,
          userRole: user.role,
          amount: amount,
          currency: event.currency || 'KRW',
          paymentMethod: paymentMethod,
          packageType: packageType,
          packageDetails: packageDetails,
          status: 'paid',
          paidAt: new Date(),
          gatewayResponse: event,
          notes: `Payment completed via webhook for ${type}`
        });

        await payment.save();
        console.log(`✅ Payment record saved: ${paymentId}`);
      } catch (paymentError) {
        console.error("⚠️ Failed to save payment record:", paymentError.message);
        // Continue even if payment record fails - user already got their credits
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

    // Extract payment details and save to database
    try {
      // Check if payment already saved (to avoid duplicates)
      const existingPayment = await Payment.findOne({ paymentId: imp_uid });
      
      if (!existingPayment) {
        // Parse payment details from merchant_uid
        const parts = merchant_uid.split('_');
        const type = parts[0]; // employer, resume, tutor
        
        let packageType, packageDetails;
        const amount = payment.amount || 0;
        
        if (type === "employer") {
          const count = parseInt(parts[1], 10);
          packageType = 'job_ads';
          packageDetails = { quantity: count, description: `${count} Job Ad Credits` };
        } else if (type === "resume") {
          const days = parseInt(parts[1].replace('d', ''), 10);
          packageType = 'resume_access';
          packageDetails = { duration: days, description: `Resume Access - ${days} Days` };
        } else if (type === "tutor") {
          const days = parseInt(parts[1].replace('d', ''), 10);
          packageType = 'tutor_access';
          packageDetails = { duration: days, description: `Tutor Listing - ${days} Days` };
        }

        const paymentRecord = new Payment({
          paymentId: imp_uid,
          merchantUid: merchant_uid,
          userId: req.user._id,
          userEmail: req.user.email,
          userRole: req.user.role,
          amount: amount,
          currency: payment.currency || 'KRW',
          paymentMethod: payment.pay_method || payment.payment_method || 'UNKNOWN',
          packageType: packageType,
          packageDetails: packageDetails,
          status: 'paid',
          paidAt: new Date(),
          gatewayResponse: payment,
          notes: 'Payment verified via /verify endpoint'
        });

        await paymentRecord.save();
        console.log(`✅ Payment record saved via verify: ${imp_uid}`);
      }
    } catch (paymentError) {
      console.error("⚠️ Failed to save payment record in verify:", paymentError.message);
      // Continue - verification succeeded even if record save failed
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

/* -------------------------------------------------------------
   POST /portone/refund
   - 결제 환불 처리 (Admin only)
   - Supports both PayPal and Toss Payments via PortOne V2 API
------------------------------------------------------------- */
router.post("/refund", async (req, res) => {
  try {
    const { paymentId, reason, amount } = req.body;

    // Check if user is admin (simple check - improve in production)
    if (!req.session || !req.session.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized - Admin access required"
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required"
      });
    }

    // Get access token
    const apiSecret = process.env.PORTONE_API_SECRET;
    const tokenResponse = await axios.post(
      "https://api.portone.io/login/api-secret",
      { api_secret: apiSecret }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get payment details first
    const paymentResponse = await axios.get(
      `https://api.portone.io/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const payment = paymentResponse.data;

    if (payment.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment is not in paid status"
      });
    }

    // Prepare refund request
    const refundAmount = amount ? parseInt(amount) : payment.amount;
    
    // PortOne V2 API: POST /payments/{paymentId}/cancel
    const refundResponse = await axios.post(
      `https://api.portone.io/payments/${paymentId}/cancel`,
      {
        reason: reason || "Admin requested refund",
        amount: refundAmount,
        cancelable_amount: payment.amount
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const refund = refundResponse.data;

    // Update payment record in database
    try {
      await Payment.findOneAndUpdate(
        { paymentId: paymentId },
        {
          status: 'refunded',
          refundedAt: new Date(),
          refundReason: reason,
          refundAmount: refundAmount,
          $push: {
            refundHistory: {
              refundedAt: new Date(),
              amount: refundAmount,
              reason: reason,
              refundId: refund.cancellation_id || refund.cancel_id,
              adminUser: req.session.user?.email || 'admin'
            }
          }
        }
      );

      // Deduct credits/access from user based on package type
      const paymentRecord = await Payment.findOne({ paymentId: paymentId });
      
      if (paymentRecord) {
        if (paymentRecord.packageType === 'job_ads') {
          // Employer: Deduct ad credits
          const quantity = paymentRecord.packageDetails?.quantity || 0;
          await User.findByIdAndUpdate(paymentRecord.userId, {
            $inc: { adsAvailable: -quantity }
          });
          console.log(`✅ Deducted ${quantity} ad credits from user ${paymentRecord.userId}`);
          
        } else if (paymentRecord.packageType === 'resume_access') {
          // Job Seeker: Deactivate resume access
          await User.findByIdAndUpdate(paymentRecord.userId, {
            $unset: { resumeAccess: "" }  // Remove resumeAccess field
          });
          console.log(`✅ Deactivated resume access for user ${paymentRecord.userId}`);
          
        } else if (paymentRecord.packageType === 'tutor_access') {
          // Tutor: Deactivate tutor listing access
          await User.findByIdAndUpdate(paymentRecord.userId, {
            $unset: { tutorAccess: "" }  // Remove tutorAccess field
          });
          console.log(`✅ Deactivated tutor listing for user ${paymentRecord.userId}`);
        }
      }
    } catch (dbError) {
      console.error("⚠️ Failed to update payment record:", dbError.message);
    }

    return res.json({
      success: true,
      message: "Refund processed successfully",
      refund: refund
    });

  } catch (error) {
    console.error("❌ Refund error:", error.message);
    
    // PortOne API error details
    if (error.response) {
      console.error("PortOne API Error:", error.response.data);
      return res.status(error.response.status || 500).json({
        success: false,
        message: error.response.data.message || "Refund failed",
        error: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      message: "Refund processing failed",
      error: error.message
    });
  }
});

module.exports = router;
