// ✅ Express + Pug 기반 Job Vacancy 입력창 구성
// 경로: router/job.js

const express = require('express');
const router = express.Router();
const Job = require('../model/job');
// const countries = require('../data/countries.json'); // ✅ ISO 국가 리스트
const auth = require('../middleware/auth');

// 입력 폼 (GET)
router.get('/create', auth, (req, res) => {
  res.render('job/create', { countries });
});

// 등록 처리 (POST)
router.post('/create', auth, async (req, res) => {
  try {
    const job = new Job({
      employerEmail: req.body.employerEmail,
      cellphone: req.body.cellphone,
      skypeID: req.body.skypeID,
      hostCountry: req.body.hostCountry,
      teachingArea: req.body.teachingArea,
      studentType: req.body.studentType,

      // ✅ 결제 관련 필드 추가
      purchaseOption: req.body.purchaseOption,          // '1', '4', '12', '24'
      resumeDBAccess: req.body.resumeDBAccess === 'on', // checkbox → Boolean
      paid: false, // 추후 결제 후 true로 변경 예정

      createdBy: req.session.user.email
    });

    await job.save();
    res.redirect('/job/list');
  } catch (err) {
    console.error('❌ Error saving job:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
