const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createOrder } = require('../config/paypal');
const resumePrices = require('../config/resumePriceConfig.js');
const ResumeAccess = require('../model/resumeAccess');

// ✅ 옵션 목록 보여주는 페이지
router.get('/', (req, res) => {
  res.render('paypal/resumeAccess', { resumeOptions: resumePrices });
});

// ✅ PayPal 결제 요청
router.get('/pay/:id', async (req, res) => {
  const selected = resumePrices.find(p => p.id === req.params.id);
  if (!selected) {
    return res.status(400).send('Invalid plan selected');
  }

  try {
    // 세션에 선택한 플랜 기억
    req.session.selectedPlan = selected.id;

    const order = await createOrder(selected.price);
    const approvalUrl = order.links.find(link => link.rel === 'approve');
    res.redirect(approvalUrl.href);
  } catch (err) {
    console.error('PayPal order creation failed:', err);
    res.status(500).send('Error creating PayPal order');
  }
});

// ✅ 결제 성공 후 접근권 저장
router.get('/success', async (req, res) => {
  const { token } = req.query;
  const planId = req.session.selectedPlan;
  const userId = req.session?.user?._id;

  if (!token || !planId || !userId) {
    return res.status(400).send('Missing token, plan, or user');
  }

  try {
    // PayPal access token 얻기
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
    const tokenRes = await axios.post(`${process.env.PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const accessToken = tokenRes.data.access_token;

    // 실제 결제 캡처 요청
    await axios.post(`${process.env.PAYPAL_API}/v2/checkout/orders/${token}/capture`, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 접근권 DB에 저장
    const days = planId === '30days' ? 30 : planId === '90days' ? 90 : 365;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const access = new ResumeAccess({
      userId,
      accessType: planId,
      expiresAt
    });

    await access.save();
    delete req.session.selectedPlan;

    req.flash('message', `✅ Resume Access for ${days} days has been activated!`);
    res.redirect('/job-seekers');
  } catch (err) {
    console.error('❌ Error capturing payment:', err);
    res.status(500).send('Failed to capture and store access');
  }
});

module.exports = router;
