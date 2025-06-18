const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const User = require('../model/user');
const tutorPriceConfig = require('../config/tutorPriceConfig'); // ✅ 튜터 가격 설정 사용

// ✅ 튜터 접근 페이지 (결제 옵션 선택)
router.get('/', requireLogin, (req, res) => {
  res.render('onlineTutor/access', {
    user: req.user,
    price: tutorPriceConfig
  });
});

// ✅ 결제 확인 페이지
router.get('/confirm', requireLogin, async (req, res) => {
  try {
    const selectedId = req.session.tutorPlan;
    const selectedPlan = tutorPriceConfig.find(plan => plan.id === selectedId);

    if (!selectedPlan) {
      return res.status(400).send('Invalid selection');
    }

    res.render('tutorAccess/confirm', {
      user: req.user,
      plan: selectedPlan,
      PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID // ✅ 정확히 이렇게
    });
  } catch (err) {
    console.error('Confirm route error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
