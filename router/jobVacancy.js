const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');

// ✅ distinct 값 추출
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

// ✅ 신규 등록 폼
router.get('/new', async (req, res) => {
  const values = await getDistinctValues();
  res.render('jobVacancy/new', { values });
});

// ✅ 등록 처리
router.post('/new', async (req, res) => {
  try {
    const data = req.body;
    const rawTitle = (data.title || '').trim();

    if (!rawTitle) {
      return res.status(400).send('❌ Job Title (URI) is required');
    }

    // ✅ 대소문자 무시 중복 검사
    const existing = await JobVacancy.findOne({
      title: { $regex: new RegExp(`^${rawTitle}$`, 'i') }
    });

    if (existing) {
      return res.status(400).send('❌ A job with the same URI already exists');
    }

    const job = new JobVacancy({
      title: rawTitle,
      description: data.description,
      country: data.country || data.countrySelect,
      studentType: data.studentType || data.studentTypeSelect,
      teachingArea: data.teachingArea || data.teachingAreaSelect,
      duration: data.duration,
      pay: data.pay,
      housing: data.housing,
      email: data.email,
      companyName: data.companyName,
      jobLocation: data.jobLocation,
      cellphoneNumber: data.cellphoneNumber,
      skypeId: data.skypeId,
      wechatId: data.wechatId,
      homepage: data.homepage,
    });

    await job.save();
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[ERROR - Job Save]:', err);
    if (err.code === 11000) {
      return res.status(400).send('❌ Duplicate title (URI) exists');
    }
    res.status(500).send('❌ Error saving job vacancy');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id);
    const values = await getDistinctValues();

    if (!jobVacancy) {
      return res.status(404).send('❌ Job Vacancy not found');
    }

    res.render('jobVacancy/edit', { jobVacancy, values });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Server error while loading edit form');
  }
});

// ✅ 수정 처리
router.post('/:id/edit', async (req, res) => {
  try {
    const data = req.body;
    const updatedTitle = (data.title || '').trim();

    // ✅ 대소문자 무시 중복 검사 (자기 자신 제외)
    const existing = await JobVacancy.findOne({
      title: { $regex: new RegExp(`^${updatedTitle}$`, 'i') },
      _id: { $ne: req.params.id }
    });

    if (existing) {
      return res.status(400).send('❌ A job with the same URI already exists');
    }

    await JobVacancy.findByIdAndUpdate(req.params.id, {
      title: updatedTitle,
      description: data.description,
      country: data.country || data.countrySelect,
      studentType: data.studentType || data.studentTypeSelect,
      teachingArea: data.teachingArea || data.teachingAreaSelect,
      duration: data.duration,
      pay: data.pay,
      housing: data.housing,
      email: data.email,
      companyName: data.companyName,
      jobLocation: data.jobLocation,
      cellphoneNumber: data.cellphoneNumber,
      skypeId: data.skypeId,
      wechatId: data.wechatId,
      homepage: data.homepage,
    });

    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[ERROR - Job Update]:', err);
    res.status(500).send('❌ Error updating job vacancy');
  }
});

// ✅ 삭제 처리
router.post('/:id/delete', async (req, res) => {
  try {
    await JobVacancy.findByIdAndDelete(req.params.id);
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[ERROR - Job Delete]:', err);
    res.status(500).send('❌ Error deleting job vacancy');
  }
});

module.exports = router;
