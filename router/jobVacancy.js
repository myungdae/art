// router/jobVacancy.js
const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');

// ✅ distinct 값 추출 함수
const getDistinctValues = async () => {
  const studentTypes = await JobVacancy.distinct('studentType');
  const countries = await JobVacancy.distinct('country');
  const teachingAreas = await JobVacancy.distinct('teachingArea');
  return { studentTypes, countries, teachingAreas };
};

// ✅ 목록 조회
router.get('/', async (req, res) => {
  const jobs = await JobVacancy.find();
  res.render('jobVacancy/index', { jobs });
});

// ✅ 신규 등록 폼 (Dropdown 포함)
router.get('/new', async (req, res) => {
  const values = await getDistinctValues();
  res.render('jobVacancy/new', { values });
});

// ✅ 등록 처리 (입력 or 선택 우선순위 적용)
router.post('/new', async (req, res) => {
  const data = req.body;

  const job = new JobVacancy({
    title: data.title,
    country: data.country || data.countrySelect,
    studentType: data.studentType || data.studentTypeSelect,
    teachingArea: data.teachingArea || data.teachingAreaSelect,
    duration: data.duration,
    pay: data.pay,
    housing: data.housing,
  });

  await job.save();
  res.redirect('/job-vacancies');
});

// ✅ 수정 폼
router.get('/:id/edit', async (req, res) => {
  const job = await JobVacancy.findById(req.params.id);
  res.render('jobVacancy/edit', { job });
});

// ✅ 수정 처리
router.post('/:id/edit', async (req, res) => {
  await JobVacancy.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/job-vacancies');
});

// ✅ 삭제 처리
router.post('/:id/delete', async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/job-vacancies');
});

module.exports = router;
