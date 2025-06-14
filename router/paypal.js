const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();
const { requireLogin } = require('../middleware/auth');


const User = require('../model/user');

const PAYPAL_API = process.env.PAYPAL_API;
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;

// ✅ Access Token
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

// ✅ [GET] Checkout Page
router.get('/checkout', (req, res) => {
  const packages = [
    { value: '1', label: '1 Ad — $30' },
    { value: '4', label: '4 Ads — $100 (Save $20)' },
    { value: '12', label: '12 Ads — $250 (Save $110)' },
    { value: '24', label: '24 Ads — $450 (Save $270)' },
  ];

  const user = req.session.user || null;

  res.render('paypal/checkout', { user: req.user, packages });
  });

// ✅ [POST] Create Order
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

// ✅ [POST] Capture Payment
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

    if (req.session.userId && adCount) {
      await User.findByIdAndUpdate(req.session.userId, {
        $inc: { adsAvailable: parseInt(adCount, 10) },
      });
    }

    res.json({ status: 'success', details: capture.data });
  } catch (error) {
    console.error('❌ capture-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

module.exports = router;
