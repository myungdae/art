const express = require('express');
const router = express.Router();
const { createOrder } = require('../config/paypal');
const priceConfig = require('../config/priceConfig');

console.log("✅ PayPal router loaded");

// ✅ Checkout 화면
router.get('/checkout', (req, res) => {
  res.render('jobVacancy/checkout', { priceOptions: priceConfig });
});

// ✅ 결제 요청 처리 (form 방식)
router.post('/create-payment', async (req, res) => {
  const selectedPackage = priceConfig.find(pkg => pkg.id === req.body.packageId);
  if (!selectedPackage) return res.status(400).send('❌ Invalid package selected');

  try {
    const order = await createOrder(selectedPackage.price);
    const approvalUrl = order.links.find(link => link.rel === 'approve')?.href;
    if (!approvalUrl) throw new Error('❌ No approval link found in PayPal response');
    res.redirect(approvalUrl);
  } catch (err) {
    console.error('[PayPal Error]', err);
    res.status(500).send('❌ Payment failed');
  }
});

// ✅ 결제 성공 후 돌아오는 경로
router.get('/success', (req, res) => {
  res.send('✅ Payment successful. Thank you!');
});

// ✅ 결제 취소 시 돌아오는 경로
router.get('/cancel', (req, res) => {
  res.send('❌ Payment cancelled.');
});

module.exports = router;
