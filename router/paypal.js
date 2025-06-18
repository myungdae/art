const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const { requireLogin } = require('../middleware/auth');
const User = require('../model/user');
const resumePriceConfig = require('../config/resumePriceConfig');
const tutorPriceConfig = require('../config/tutorPriceConfig');

const PAYPAL_API = process.env.PAYPAL_API;
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;

// ✅ PayPal Access Token
async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
  const res = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return res.data.access_token;
}

// ✅ [GET] Job Vacancy Checkout 페이지
router.get('/checkout', requireLogin, (req, res) => {
  const packages = [
    { value: '1', label: '1 Ad — $30' },
    { value: '4', label: '4 Ads — $100 (Save $20)' },
    { value: '12', label: '12 Ads — $250 (Save $110)' },
    { value: '24', label: '24 Ads — $450 (Save $270)' },
  ];

  if (!req.session.userId && req.user && req.user._id) {
    req.session.userId = req.user._id;
    console.log('🆔 Set req.session.userId =', req.user._id);
  }

  res.render('paypal/checkout', {
    user: req.user,
    packages
  });
});

// ✅ [POST] tutor-access or resume-access에서 role 전달 시 처리
router.post('/checkout', requireLogin, async (req, res) => {
  const { role, planId } = req.body;

  if (role === 'Job_Seeker') {
    const selected = resumePriceConfig.find(p => p.id === planId);
    if (!selected) return res.status(400).send('Invalid plan for resume access');
    req.session.resumePlan = planId;
    return res.redirect('/resume-access/confirm');
  }

  if (role === 'Online_Tutor') {
    const selected = tutorPriceConfig.find(p => p.id === planId);
    if (!selected) return res.status(400).send('Invalid plan for tutor access');
    req.session.tutorPlan = planId;
    return res.redirect('/tutor-access/confirm');
  }

  return res.status(400).send('Invalid role');
});

// ✅ [POST] Create PayPal Order
router.post('/create-order', async (req, res) => {
  try {
    const selectedPackage = req.body.package || '1';
    const packagePrices = {
      '1': '30.00',
      '4': '100.00',
      '12': '250.00',
      '24': '450.00',
    };

    const accessToken = await getAccessToken();
    const order = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: packagePrices[selectedPackage] || '30.00',
            },
            description: `${selectedPackage} Job Vacancy Ads`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ id: order.data.id });
  } catch (error) {
    console.error('❌ create-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

// ✅ [POST] Capture PayPal Order
router.post('/capture-order/:orderID', async (req, res) => {
  try {
    const { orderID } = req.params;
    const { package: adCount } = req.body;
    const accessToken = await getAccessToken();

    const capture = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // ✅ Job Vacancy 광고권 처리
    if (req.session.userId && adCount) {
      const updatedUser = await User.findByIdAndUpdate(
        req.session.userId,
        { $inc: { adsAvailable: parseInt(adCount, 10) } },
        { new: true }
      );

      if (updatedUser) {
        req.session.user.adsAvailable = updatedUser.adsAvailable;
      }

      return res.json({ status: 'redirect', url: '/job-vacancies/new_paid_user' });
    }

    // ✅ Online Tutor 처리
    if (req.session.userId && req.session.tutorPlan) {
      const tutorPlanId = req.session.tutorPlan;
      const selected = tutorPriceConfig.find(p => p.id === tutorPlanId);

      if (selected) {
        const durationDays = selected.days;

        await User.findByIdAndUpdate(req.session.userId, {
          resumeAccess: {
            startDate: new Date(),
            durationDays,
          }
        });

        return res.json({ status: 'redirect', url: '/user/mypage' });
      }
    }

    // ✅ Resume Access 처리
    if (req.session.userId && req.session.resumePlan) {
      const resumePlanId = req.session.resumePlan;
      const selected = resumePriceConfig.find(p => p.id === resumePlanId);

      if (selected) {
        const durationDays = selected.days;

        await User.findByIdAndUpdate(req.session.userId, {
          resumeAccess: {
            startDate: new Date(),
            durationDays,
          }
        });

        return res.json({ status: 'redirect', url: '/user/mypage' });
      }
    }

    res.status(400).json({ error: 'Invalid payment context' });

  } catch (error) {
    console.error('❌ capture-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

module.exports = router;
