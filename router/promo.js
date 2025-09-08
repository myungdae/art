// /home/ubuntu/esl/router/promo.js
const express = require('express');
const router = express.Router();

// 선택: 운영중인 회원가입 경로를 지정하세요.
// /signup 이 없다면 /user/register 로 두세요.
const REGISTER_PATH = '/user/register'; // or '/signup'

// 연말 프로모션 코드 (페이지/쿼리에서 사용할 값)
const PROMO_CODE = 'yearend2025';

// 시작점: 로그인 안됐으면 회원가입으로(next=/promo/choose-role),
// 로그인돼 있으면 바로 역할 선택 페이지로 보냄
router.get('/start', (req, res) => {
  const next = '/promo/choose-role';
  if (req.user) return res.redirect(next);
  return res.redirect(`${REGISTER_PATH}?promo=${PROMO_CODE}&next=${encodeURIComponent(next)}`);
});

// 역할 선택 페이지 뷰 렌더
router.get('/choose-role', (req, res) => {
  res.render('promo/choose-role', {
    title: 'Choose your role',
    promoCode: PROMO_CODE,
  });
});

module.exports = router;
