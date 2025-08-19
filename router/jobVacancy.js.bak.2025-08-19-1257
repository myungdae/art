// router/jobVacancy.js (TEMP SAFE)
'use strict';
const express = require('express');
const router = express.Router();

console.log('### LOADED SAFE jobVacancy.js ###', __filename);

// 목록 → 패싯으로 연결
router.get('/', (req, res) => res.redirect('/facet/Job_Vacancies'));

// 새 공고 폼(뷰에 필요한 locals를 안전하게 채워줌)
router.get('/new', (req, res) => {
  res.render('jobVacancy/new', {
    countries: [],
    studentTypes: [],
    teachingAreas: []
  });
});

// 임시: 저장 미구현 표시(추후 실제 저장 로직 교체)
router.post('/', (req, res) => res.status(501).send('Not implemented (stub)'));

// 내 공고 리스트(임시)
router.get('/mine', (req, res) => res.json([]));

module.exports = router;
