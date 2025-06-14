const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const User = require('../model/user');
const sanitizeHtml = require('sanitize-html');
const priceConfig = require('../config/priceConfig');
const { requireLogin } = require('../middleware/auth');
const requireEmployer = require('../middleware/requireEmployer');

console.log("✅ jobVacancyRouter loaded");

const getDistinctValues = async () => {
  const [studentTypesFromDB, countriesFromDB, teachingAreasFromDB] = await Promise.all([
    JobVacancy.distinct('studentType'),
    JobVacancy.distinct('country'),
    JobVacancy.distinct('teachingArea')
  ]);

  const defaultCountries = ['USA', 'South Korea', 'Japan', 'Vietnam', 'China'];
  const defaultStudentTypes = ['Adults', 'Elementary', 'High School'];
  const defaultTeachingAreas = ['English', 'Math', 'Science'];

  return {
    countries: [...new Set([...defaultCountries, ...countriesFromDB])].sort(),
    studentTypes: [...new Set([...defaultStudentTypes, ...studentTypesFromDB])].sort(),
    teachingAreas: [...new Set([...defaultTeachingAreas, ...teachingAreasFromDB])].sort()
  };
};

const htmlSanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['style', 'class'] },
  allowedSchemes: ['http', 'https']
};

// ✅ 목록 조회
router.get('/', async (req, res) => {
  const jobs = await JobVacancy.find();
  res.render('jobVacancy/index', { jobs });
});

// ✅ 신규 등록 폼 (adsAvailable 체크 포함)
router.get('/new', requireLogin, requireEmployer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const values = await getDistinctValues();
    const hasAdSlots = user && user.adsAvailable > 0;

    res.render('jobVacancy/new', {
      message: null,
      showPayment: !hasAdSlots, // ✅ 광고가 없으면 결제 유도
      ...values,
      priceOptions: priceConfig
    });
  } catch (err) {
    console.error('[ERROR - GET /job-vacancies/new]:', err);
    res.status(500).send('❌ Failed to load new job form');
  }
});

// ✅ 신규 등록 처리
router.post('/new', requireLogin, requireEmployer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.adsAvailable <= 0) {
      const values = await getDistinctValues();
      return res.status(403).render('jobVacancy/new', {
        message: '❌ You have no remaining ad slots. Please purchase a package to continue.',
        showPayment: true,
        ...values,
        priceOptions: priceConfig
      });
    }

    const { title, description, ...rest } = req.body;
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) return res.status(400).send('❌ Job Title is required');
    if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu.test(cleanTitle)) {
      return res.status(400).send('❌ Title cannot include emojis or special characters');
    }

    const exists = await JobVacancy.findOne({ title: new RegExp(`^${cleanTitle}$`, 'i') });
    if (exists) return res.status(400).send('❌ A job with the same title already exists');

    const job = new JobVacancy({
      title: cleanTitle,
      description: sanitizeHtml(description || '', htmlSanitizeOptions),
      ...rest,
      addResumeAccess: rest.addResumeAccess === 'yes',
      user: req.user._id
    });

    await job.save();
    await User.findByIdAndUpdate(req.user._id, { $inc: { adsAvailable: -1 } });

    const values = await getDistinctValues();
    res.render('jobVacancy/new', {
      message: '✅ Your job post has been saved.',
      showPayment: true,
      ...values,
      priceOptions: priceConfig
    });
  } catch (err) {
    console.error('[ERROR - Job Save]:', err);
    res.status(500).send('❌ Error saving job vacancy');
  }
});

module.exports = router;
