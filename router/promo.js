// router/promo.js
'use strict';

const express = require('express');
const router = express.Router();
const { isFreeWindowOpen } = require('../utils/freeMode');

// --- health check
router.get('/ping', (req, res) => {
  res.type('text/plain').send('promo router OK');
});

// --- debug routes (진단용)
router.get('/start-plain', (req, res) => {
  res.type('text/plain').send('start-plain OK');
});

router.get('/start-json', (req, res) => {
  const open = isFreeWindowOpen();
  const loggedIn = !!req.user;
  res.json({
    open,
    loggedIn,
    nextIfNotLoggedIn: '/signup?promo=yearend2025&next=/promo/choose-role',
    nextIfLoggedIn: '/promo/choose-role'
  });
});

// --- real routes
router.get('/start', (req, res) => {
  // 프로모 기간이 아니면 홈으로
  if (!isFreeWindowOpen()) return res.redirect('/');

  // 미로그인 → 회원가입 후 /promo/choose-role로 복귀
  if (!req.user) {
    const next = encodeURIComponent('/promo/choose-role');
    return res.redirect(`/signup?promo=yearend2025&next=${next}`);
  }

  // 로그인 상태 → 바로 역할 선택
  return res.redirect('/promo/choose-role');
});

router.get('/choose-role', (req, res) => {
  if (!isFreeWindowOpen()) return res.redirect('/');

  if (!req.user) {
    const next = encodeURIComponent('/promo/choose-role');
    return res.redirect(`/signup?promo=yearend2025&next=${next}`);
  }

  return res.render('promo-choose-role', {
    freeUntilStr: (process.env.FREE_UNTIL || '').slice(0, 10)
  });
});

module.exports = router;
