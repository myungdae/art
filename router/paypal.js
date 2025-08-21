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

const validateObjectId = require('../middleware/validateObjectId');

router.param('id', validateObjectId('id'));

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

// ✅ [GET] Job Vacancy Checkout
router.get('/checkout', requireLogin, (req, res) => {
  const packages = [
    { value: '1', label: '1 Ad — $30' },
    { value: '4', label: '4 Ads — $100 (Save $20)' },
    { value: '12', label: '12 Ads — $250 (Save $110)' },
    { value: '24', label: '24 Ads — $450 (Save $270)' },
  ];

  res.render('paypal/checkout', {
    user: req.user,
    packages
  });
});

// ✅ [GET] Resume Access Checkout
router.get('/checkout-resume', requireLogin, (req, res) => {
  const packages = resumePriceConfig.map(p => ({
    value: p.id,
    label: p.label,
    price: p.price
  }));

  res.render('paypal/checkout_resume', {
    user: req.user,
    packages
  });
});

// ✅ [POST] Create PayPal Order
router.post('/create-order', requireLogin, async (req, res) => {
  try {
    const { planId, adPackage } = req.body;

    let purchaseUnit = null;

    if (planId) {
      const selected = resumePriceConfig.find(p => p.id === planId);
      if (!selected) return res.status(400).json({ error: 'Invalid resume plan' });

      req.session.resumePlan = planId;
      purchaseUnit = {
        amount: {
          currency_code: 'USD',
          value: selected.price.toFixed(2),
        },
        description: selected.label,
      };
    } else if (adPackage) {
      const prices = {
        '1': 30,
        '4': 100,
        '12': 250,
        '24': 450
      };
      purchaseUnit = {
        amount: {
          currency_code: 'USD',
          value: (prices[adPackage] || 30).toFixed(2),
        },
        description: `${adPackage} Job Vacancy Ads`,
      };
      req.session.adPackage = adPackage;
    } else {
      return res.status(400).json({ error: 'No valid purchase data' });
    }

    const accessToken = await getAccessToken();
    const order = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [purchaseUnit],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    res.json({ id: order.data.id });

  } catch (error) {
    console.error('❌ create-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ✅ [POST] Capture PayPal Order
router.post('/capture-order/:orderID', requireLogin, async (req, res) => {
  try {
    const { orderID } = req.params;
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

    if (req.session.adPackage) {
      const count = parseInt(req.session.adPackage, 10);
      await User.findByIdAndUpdate(req.session.userId, { $inc: { adsAvailable: count } });
      return res.json({ status: 'redirect', url: '/job-vacancies/new_paid_user' });
    }

    if (req.session.resumePlan) {
      const selected = resumePriceConfig.find(p => p.id === req.session.resumePlan);
      if (selected) {
        await User.findByIdAndUpdate(req.session.userId, {
          resumeAccess: {
            startDate: new Date(),
            durationDays: selected.days,
          }
        });
        return res.json({ status: 'redirect', url: '/resume-access/confirm' });
      }
    }

    res.status(400).json({ error: 'Invalid payment context' });

  } catch (error) {
    console.error('❌ capture-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

module.exports = router;
