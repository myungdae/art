const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');

// 목록 페이지
router.get('/', async (req, res) => {
  const jobs = await JobVacancy.find();
  res.render('jobVacancy/list', { jobs });
});

// 새 Job 등록 폼
router.get('/new', (req, res) => {
  res.render('jobVacancy/new');
});

// Job 등록 처리
router.post('/new', async (req, res) => {
  console.log('📦 [CREATE] JobVacancy POST body:', req.body);

  try {
    const {
      title,
      description,
      country,
      studentType,
      teachingArea,
      duration,
      pay,
      housing,
      email,
      companyName,
      jobLocation,
      cellphoneNumber,
      skypeId,
      wechatId,
      homepage,
      adPackage,
      addResumeAccess
    } = req.body;

    const newJob = new JobVacancy({
      title,
      description,
      country,
      studentType,
      teachingArea,
      duration,
      pay,
      housing,
      email,
      companyName,
      jobLocation,
      cellphoneNumber,
      skypeId,
      wechatId,
      homepage,
      adPackage,
      addResumeAccess: addResumeAccess === 'yes'
    });

    await newJob.save();
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('❌ JobVacancy 저장 실패:', err);
    res.status(400).send('JobVacancy 저장 실패');
  }
});

// 수정 폼
router.get('/edit/:id', async (req, res) => {
  const job = await JobVacancy.findById(req.params.id);
  res.render('jobVacancy/edit', { job });
});

// 수정 처리
router.post('/edit/:id', async (req, res) => {
  console.log('📦 [UPDATE] JobVacancy POST body:', req.body);

  try {
    const updateData = {
      ...req.body,
      addResumeAccess: req.body.addResumeAccess === 'yes'
    };

    await JobVacancy.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('❌ JobVacancy 수정 실패:', err);
    res.status(400).send('JobVacancy 수정 실패');
  }
});

// 삭제
router.get('/delete/:id', async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/job-vacancies');
});

module.exports = router;
