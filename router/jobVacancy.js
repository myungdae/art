// router/jobVacancy.js (REAL)
'use strict';
const express = require('express');
const router = express.Router();

console.log('### LOADED REAL jobVacancy.js ###', __filename);

// 고용주 광고 플랜(개수만, 가격은 향후 연결)
const AD_PLANS = [
  { ads: 1,  label: '1 Ad'  },
  { ads: 4,  label: '4 Ads' },
  { ads: 12, label: '12 Ads'},
  { ads: 24, label: '24 Ads'}
];

// 목록은 기존 패싯으로 연결
router.get('/', (req, res) => res.redirect('/facet/Job_Vacancies'));

// 새 공고 폼: 플랜과(필요시) 토큰 잔액 전달
router.get('/new', (req, res) => {
  const employer = (req.session && req.session.user && req.session.user.employer) || {};
  // 프로젝트에 실제 쓰는 필드명으로 자동 추정(없으면 null)
  const tokensLeft = employer.promoTokens ?? employer.tokens ?? employer.jobTokens ?? null;

  res.render('jobVacancy/new', {
    countries: [],
    studentTypes: [],
    teachingAreas: [],
    adPlans: AD_PLANS,   // ← 뷰에서 플랜 렌더링에 사용
    tokensLeft           // ← 있으면 안내문구에 사용
  });
});

// 저장 로직은 기존 모델/유효성에 맞춰 추후 연결
router.post('/', (req, res) => res.status(501).send('Not implemented here'));

router.get('/mine', (req, res) => res.json([])); // 임시

module.exports = router;
