// router/jobVacancy.js
const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');

// 목록 조회
router.get('/', async (req, res) => {
  const jobs = await JobVacancy.find();
  res.render('jobVacancy/index', { jobs });
});

// 신규 등록 폼
router.get('/new', (req, res) => {
  res.render('jobVacancy/new');
});

// 등록 처리
router.post('/new', async (req, res) => {
  const job = new JobVacancy(req.body);
  await job.save();
  res.redirect('/job-vacancies');
});

// 수정 폼
router.get('/:id/edit', async (req, res) => {
  const job = await JobVacancy.findById(req.params.id);
  res.render('jobVacancy/edit', { job });
});

// 수정 처리
router.post('/:id/edit', async (req, res) => {
  await JobVacancy.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/job-vacancies');
});

// 삭제 처리
router.post('/:id/delete', async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/job-vacancies');
});

module.exports = router;
