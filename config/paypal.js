const axios = require('axios');
require('dotenv').config();

// 1) 모드 기반 엔드포인트 자동 선택
const MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
// PAYPAL_API가 명시돼 있으면 우선 사용(강제 오버라이드), 없으면 모드로 분기
const DEFAULT_API = MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
const PAYPAL_API = process.env.PAYPAL_API || DEFAULT_API;

// 2) 키 읽기 (신규/구식 호환)
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET;

// 3) 공통 액세스 토큰 발급
async function getAccessToken() {
  if (!CLIENT_ID || !SECRET) {
    throw new Error('[PayPal] Missing CLIENT_ID or SECRET. Check .env');
  }
  const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
  const res = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    }
  );
  return res.data.access_token;
}

// 4) 주문 생성
async function createOrder(amount) {
  const accessToken = await getAccessToken();
  const res = await axios.post(
    `${PAYPAL_API}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amount.toString(),
          },
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return res.data;
}

module.exports = { createOrder };
