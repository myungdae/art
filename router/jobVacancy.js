// router/jobVacancy.js (save + expiresAt + token decrement)
'use strict';
const express = require('express');
const router = express.Router();

const { employerAdPlans, defaultJobAdLifetimeDays } = require('../config/plans');

let JobVacancy = null;
try {
  JobVacancy = require('../model/jobVacancy');
} catch (e) {
  console.warn('⚠️ model/jobVacancy 가 없어 POST 저장은 비활성 상태입니다.');
}

let User = null;
try {
  User = require('../models/User');
} catch (e) {
  console.warn('⚠️ models/User 를 찾지 못했습니다. 토큰 차감은 세션 값만 갱신됩니다.');
}

console.log('### LOADED REAL jobVacancy.js ###', __filename);

// 목록 → 패싯으로
router.get('/', (req, res) => res.redirect('/facet/Job_Vacancies'));

// 새 공고 폼
router.get('/new', (req, res) => {
  const tokensLeft =
    req.user && typeof req.user.adTokens === 'number' ? req.user.adTokens : null;

  res.render('jobVacancy/new', {
    countries: [],
    studentTypes: [],
    teachingAreas: [],
    adPlans: employerAdPlans,
    tokensLeft
  });
});

// 저장 (expiresAt 자동 세팅 + 토큰 차감)
router.post('/', async (req, res) => {
  if (!JobVacancy) {
    return res.status(501).send('JobVacancy model missing. Create model/jobVacancy.js first.');
  }

  // 1) 사전 체크: adTokens가 0 이하면 결제 페이지로
  if (req.user && typeof req.user.adTokens === 'number') {
    if (req.user.adTokens <= 0) {
      return res.redirect('/payment/employer');
    }
  }

  try {
    const now = new Date();

    // 특수 네임(Key)로 들어오는 필드들 안전 추출
    const title =
      req.body['rdfs:label[@value]'] ||
      req.body['rdfs:label'] ||
      req.body.title ||
      '';

    const description =
      req.body['http://purl.org/dc/elements/1.1/description[@value]'] ||
      req.body.description ||
      '';

    const adCount = parseInt(req.body.adCount, 10) || 1;

    const doc = {
      title,
      description,
      country: req.body.country || '',
      studentType: req.body.studentType || '',
      teachingArea: req.body.teachingArea || '',
      duration: req.body.duration || '',
      pay: req.body.pay || '',
      housing: req.body.housing || '',
      email: req.body.email || '',
      companyName: req.body.companyName || '',
      jobLocation: req.body.jobLocation || '',
      cellphoneNumber: req.body.cellphoneNumber || '',
      skypeId: req.body.skypeId || '',
      wechatId: req.body.wechatId || '',
      homepage: req.body.homepage || '',
      datePosted: req.body.datePosted ? new Date(req.body.datePosted) : now,

      adCount,                     // 선택한 광고 수
      createdBy: req.user?._id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + defaultJobAdLifetimeDays * 86400000),
      status: 'active',
    };

    // 2) 공고 저장
    const saved = await JobVacancy.create(doc);
    console.log('💾 Saved JobVacancy:', saved._id, 'expiresAt=', saved.expiresAt.toISOString());

    // 3) 토큰 차감 (가능할 때만)
    if (req.user && typeof req.user.adTokens === 'number') {
      if (User) {
        // adTokens >= 1 일 때만 -1 (원자적 조건 갱신)
        const r = await User.updateOne(
          { _id: req.user._id, adTokens: { $gte: 1 } },
          { $inc: { adTokens: -1 } }
        );

        if (!r || r.modifiedCount !== 1) {
          // 차감 실패(경쟁 등). 저장한 공고를 롤백하고 결제 페이지로 유도
          await JobVacancy.deleteOne({ _id: saved._id });
          console.warn('⚠️ Token decrement failed. Rolled back vacancy:', saved._id);
          return res.redirect('/payment/employer');
        }

        // 세션/req.user 동기화 (있을 때만)
        if (req.session && req.session.user && typeof req.session.user.adTokens === 'number') {
          req.session.user.adTokens = Math.max(0, req.session.user.adTokens - 1);
        }
        if (typeof req.user.adTokens === 'number') {
          req.user.adTokens = Math.max(0, req.user.adTokens - 1);
        }
      } else {
        // User 모델이 없으면 세션 값만 감소(영속 X)
        if (req.session && req.session.user && typeof req.session.user.adTokens === 'number') {
          req.session.user.adTokens = Math.max(0, req.session.user.adTokens - 1);
        }
        if (typeof req.user.adTokens === 'number') {
          req.user.adTokens = Math.max(0, req.user.adTokens - 1);
        }
      }
    }

    return res.redirect('/facet/Job_Vacancies');
  } catch (err) {
    console.error('❌ Failed to save JobVacancy', err);
    return res.status(500).send('Failed to save job vacancy');
  }
});

// 내 공고 리스트(임시)
router.get('/mine', (req, res) => res.json([]));

module.exports = router;
