// router/mypage-redirect.js
const express = require('express');
const router = express.Router();

const PROMO_CODE = 'yearend2025';

// 공통 헬퍼: 비로그인 시 등록창으로 보냄 (+ role 힌트)
function redirectAnonToRegister(req, res, roleHint) {
  if (!req.user) {
    const q = new URLSearchParams({
      promo: PROMO_CODE,
      prefRole: roleHint, // 등록 UI가 역할 카드 미리 선택할 때 쓰도록 힌트
    }).toString();
    return res.redirect(`/user/register?${q}`);
  }
  return null; // 로그인 상태면 계속 진행
}

// 1) Employer
router.get('/mypage-employer', (req, res, next) => {
  if (redirectAnonToRegister(req, res, 'Employer')) return;

  // 로그인 상태 → 기존 마이페이지 렌더
  // (이미 쓰고 계신 템플릿/핸들러 이름에 맞게 조정)
  return res.render('mypage/employer'); 
});

// 2) Job Seeker
router.get('/mypage-jobseeker', (req, res, next) => {
  if (redirectAnonToRegister(req, res, 'Job Seeker')) return;
  return res.render('mypage/jobseeker');
});

// 3) Online Tutor
router.get('/mypage-tutor', (req, res, next) => {
  if (redirectAnonToRegister(req, res, 'Online Tutor')) return;
  return res.render('mypage/tutor');
});

module.exports = router;
