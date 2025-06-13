const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const PAYPAL_API = process.env.PAYPAL_API; // https://api-m.sandbox.paypal.com
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;

// ✅ Access Token 발급
async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
  const res = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return res.data.access_token;
}

// ✅ [GET] 결제 페이지 렌더링
router.get('/checkout', (req, res) => {
  res.render('paypal/checkout'); // views/paypal/checkout.pug
});

// ✅ [POST] PayPal 결제 주문 생성
router.post('/create-order', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const order = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '30.00'
        },
        description: '1 Job Vacancy Ad'
      }]
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ id: order.data.id });
  } catch (error) {
    console.error('❌ create-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

// ✅ [POST] 결제 승인 후 실제 결제 캡처
router.post('/capture-order/:orderID', async (req, res) => {
  try {
    const { orderID } = req.params;
    const accessToken = await getAccessToken();

    const capture = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // ✳️ 향후 DB 업데이트 등 후처리 여기에 추가 가능
    // await JobVacancy.updateOne({ user: req.session.userId }, { paymentStatus: 'paid' });

    res.json({ status: 'success', details: capture.data });
  } catch (error) {
    console.error('❌ capture-order error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

// ✅ 결제 성공 메시지
router.get('/success', (req, res) => {
  res.send('✅ Payment successful. Thank you!');
});

// ✅ 결제 취소 메시지
router.get('/cancel', (req, res) => {
  res.send('❌ Payment cancelled.');
});

module.exports = router;
