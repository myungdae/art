// router/home.js — CommonJS (경량 실전 버전)
'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const VAC   = 'Job_Vacancies';
const SEEK  = 'Job_Seekers';
const TUTOR = 'Online_Tutors';

// no-cache
const nocache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
};

// 홈
router.get('/', nocache, async (_req, res) => {
  try {
    // 필요한 경우 템플릿 변수 추가 가능
    res.render('home');
  } catch (e) {
    console.error('[home /] error:', e);
    res.status(500).render('error', { message: 'Failed to load home.' });
  }
});

// 카운터 API (프론트에서 사용 중)
router.get('/api/home/stats', nocache, async (_req, res) => {
  try {
    const db = mongoose.connection?.db;
    if (!db) return res.json({ vCount: 0, sCount: 0, tCount: 0 });

    const [vCount, sCount, tCount] = await Promise.all([
      db.collection(`${VAC}_RDF`).countDocuments({}),
      db.collection(`${SEEK}_RDF`).countDocuments({}),
      db.collection(`${TUTOR}_RDF`).countDocuments({})
    ]);

    res.json({ vCount, sCount, tCount });
  } catch (e) {
    console.error('[api/home/stats] error:', e);
    res.status(500).json({ vCount: 0, sCount: 0, tCount: 0 });
  }
});

// (선택) 검색 리다이렉트: /go?facet=Job_Vacancies&q=math
router.get('/go', (req, res) => {
  const facet = (req.query.facet || '').trim();
  const q = (req.query.q || '').trim();
  if (!facet) return res.redirect('/');
  const base = `/facet/${encodeURIComponent(facet)}`;
  const url = q ? `${base}?q=${encodeURIComponent(q)}` : base;
  return res.redirect(url);
});

module.exports = router;
