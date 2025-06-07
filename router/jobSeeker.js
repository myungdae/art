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
  await JobSeeker.create(req.body);
  res.redirect('/job-seekers');
});

// 수정 폼
router.get('/edit/:id', async (req, res) => {
  const seeker = await JobSeeker.findById(req.params.id);
  res.render('jobSeeker/edit', { seeker });
});

// 수정 처리
router.post('/edit/:id', async (req, res) => {
  await JobSeeker.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/job-seekers');
});

// 삭제
router.get('/delete/:id', async (req, res) => {
  await JobSeeker.findByIdAndDelete(req.params.id);
  res.redirect('/job-seekers');
});

module.exports = router;
