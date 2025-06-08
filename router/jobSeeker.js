const express = require('express');
const router = express.Router();
const JobSeeker = require('../model/jobSeeker');

// 목록
router.get('/', async (req, res) => {
  const seekers = await JobSeeker.find();
  res.render('jobSeeker/list', { seekers });
});

// 생성 폼
router.get('/new', (req, res) => {
  res.render('jobSeeker/create');
});

// 생성 처리
router.post('/new', async (req, res) => {
  console.log('📦 [CREATE] JobSeeker POST body:', req.body);  // ✅ 추가
  try {
    await JobSeeker.create(req.body);
    res.redirect('/job-seekers');
  } catch (err) {
    console.error('❌ JobSeeker 저장 실패:', err);
    res.status(400).send('JobSeeker 저장 실패');
  }
});

// 수정 폼
router.get('/edit/:id', async (req, res) => {
  const seeker = await JobSeeker.findById(req.params.id);
  res.render('jobSeeker/edit', { seeker });
});

// 수정 처리
router.post('/edit/:id', async (req, res) => {
  console.log('📦 [UPDATE] JobSeeker POST body:', req.body);  // ✅ 추가
  try {
    await JobSeeker.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/job-seekers');
  } catch (err) {
    console.error('❌ JobSeeker 수정 실패:', err);
    res.status(400).send('JobSeeker 수정 실패');
  }
});

// 삭제
router.get('/delete/:id', async (req, res) => {
  await JobSeeker.findByIdAndDelete(req.params.id);
  res.redirect('/job-seekers');
});

module.exports = router;
