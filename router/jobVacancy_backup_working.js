const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const priceConfig = require('../config/priceConfig');
const { requireLogin } = require('../middleware/auth');
const requireEmployer = require('../middleware/requireEmployer');

console.log("✅ jobVacancyRouter loaded");

const defaultCountries = [
  'Australia', 'Bangladesh', 'Brazil', 'Canada', 'China', 'Egypt',
  'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan',
  'Malaysia', 'Mexico', 'Netherlands', 'Pakistan', 'Philippines',
  'Poland', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa',
  'South Korea', 'Spain', 'Thailand', 'Turkey', 'UK', 'Ukraine',
  'USA', 'Vietnam'
];

const defaultStudentTypes = [
  'Adults', 'Business Professionals', 'Elementary', 'High School',
  'Kindergarten', 'Language Center', 'Middle School', 
  'Private Tutoring', 'Test Preparation'
];

const defaultTeachingAreas = [
  'English', 'ESL', 'History', 'Korean',
  'Math', 'Music', 'PE', 'Physics', 'Science', 'Social Studies', 'Spanish'
];

const getDistinctValues = async () => {
  const studentTypesFromDB = await JobVacancy.distinct('studentType');
  const countriesFromDB = await JobVacancy.distinct('country');
  const teachingAreasFromDB = await JobVacancy.distinct('teachingArea');
  return {
    countries: [...new Set([...defaultCountries, ...countriesFromDB])].sort(),
    studentTypes: [...new Set([...defaultStudentTypes, ...studentTypesFromDB])].sort(),
    teachingAreas: [...new Set([...defaultTeachingAreas, ...teachingAreasFromDB])].sort()
  };
};

const htmlSanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'h1', 'h2', 'h3', 'span', 'a'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['style', 'class'],
    '*': ['style', 'class']
  },
  allowedSchemes: ['http', 'https']
};

// ✅ 목록 조회
router.get('/', async (req, res) => {
  const jobs = await JobVacancy.find();
  res.render('jobVacancy/index', { jobs });
});

// ✅ 신규 등록 폼
router.get('/new', requireLogin, requireEmployer, async (req, res) => {
  const values = await getDistinctValues();
  res.render('jobVacancy/new', {
    message: null,
    showPayment: false,
    countries: values.countries,
    studentTypes: values.studentTypes,
    teachingAreas: values.teachingAreas,
    priceOptions: priceConfig
  });
});

// ✅ 신규 등록 처리
router.post('/new', requireLogin, requireEmployer, async (req, res) => {
  try {
    const data = req.body;
    const rawTitle = (data.title || '').trim();
    if (!rawTitle) return res.status(400).send('❌ Job Title is required');

    const forbiddenEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    if (forbiddenEmoji.test(rawTitle)) {
      return res.status(400).send('❌ Title cannot include emojis or special characters');
    }

    const existing = await JobVacancy.findOne({ title: { $regex: new RegExp(`^${rawTitle}$`, 'i') } });
    if (existing) return res.status(400).send('❌ A job with the same title already exists');

    const cleanDescription = sanitizeHtml(data.description || '', htmlSanitizeOptions);

    const job = new JobVacancy({
      title: rawTitle,
      description: cleanDescription,
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
      adPackage: data.adPackage,
      addResumeAccess: data.addResumeAccess === 'yes'
    });

    await job.save();

    const values = await getDistinctValues();
    res.render('jobVacancy/new', {
      message: '✅ Your job post has been saved.',
      showPayment: true,
      countries: values.countries,
      studentTypes: values.studentTypes,
      teachingAreas: values.teachingAreas,
      priceOptions: priceConfig
    });
  } catch (err) {
    console.error('[ERROR - Job Save]:', err);
    if (err.code === 11000) return res.status(400).send('❌ Duplicate title detected');
    res.status(500).send('❌ Error saving job vacancy');
  }
});

// ✅ 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id);
    if (!jobVacancy) return res.status(404).send('❌ Job not found');
    res.render('jobVacancy/show', { jobVacancy });
  } catch (err) {
    console.error('[ERROR - Load Show Page]:', err);
    res.status(500).send('❌ Error loading job');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', requireLogin, requireEmployer, async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id);
    if (!jobVacancy) return res.status(404).send('❌ Job not found');

    const values = await getDistinctValues();
    const formattedDate = jobVacancy.datePosted
      ? new Date(jobVacancy.datePosted).toISOString().slice(0, 10)
      : '';

    res.render('jobVacancy/edit', {
      jobVacancy,
      countries: values.countries,
      studentTypes: values.studentTypes,
      teachingAreas: values.teachingAreas,
      datePostedFormatted: formattedDate,
      priceOptions: priceConfig
    });
  } catch (err) {
    console.error('[ERROR - Load Edit Form]:', err);
    res.status(500).send('❌ Error loading edit form');
  }
});

// ✅ 수정 처리
router.post('/:id/edit', requireLogin, requireEmployer, async (req, res) => {
  try {
    const data = req.body;
    const rawTitle = (data.title || '').trim();
    if (!rawTitle) return res.status(400).send('❌ Job Title is required');

    const forbiddenEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    if (forbiddenEmoji.test(rawTitle)) {
      return res.status(400).send('❌ Title cannot include emojis or special characters');
    }

    const existing = await JobVacancy.findOne({
      title: { $regex: new RegExp(`^${rawTitle}$`, 'i') },
      _id: { $ne: req.params.id }
    });
    if (existing) return res.status(400).send('❌ A job with the same title already exists');

    const cleanDescription = sanitizeHtml(data.description || '', htmlSanitizeOptions);

    await JobVacancy.findByIdAndUpdate(req.params.id, {
      title: rawTitle,
      description: cleanDescription,
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
      datePosted: data.datePosted,
      adPackage: data.adPackage,
      addResumeAccess: data.addResumeAccess === 'yes'
    });

    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[ERROR - Job Update]:', err);
    res.status(500).send('❌ Error updating job vacancy');
  }
});

// ✅ 삭제 처리
router.post('/:id/delete', requireLogin, requireEmployer, async (req, res) => {
  try {
    await JobVacancy.findByIdAndDelete(req.params.id);
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[ERROR - Job Delete]:', err);
    res.status(500).send('❌ Error deleting job vacancy');
  }
});

module.exports = router;
