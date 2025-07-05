const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { createFacetEntryFromCRUD } = require('../utils/createFacetEntry');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

// ✅ /job-vacancies 는 로그인 유도용
router.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/user/login');
  }
  return res.redirect('/facet/Job_Vacancies');
});

router.get('/new', requireLogin, (req, res) => {
  res.render('jobVacancy/new');
});

router.get('/new_paid_user', requireLogin, async (req, res) => {
  const [studentTypes, countries, teachingAreas] = await Promise.all([
    JobVacancy.distinct('studentType'),
    JobVacancy.distinct('country'),
    JobVacancy.distinct('teachingArea')
  ]);
  res.render('jobVacancy/new_paid_user', { studentTypes, countries, teachingAreas });
});

router.post('/new', requireLogin, async (req, res) => {
  await saveJob(req, res);
});

router.post('/new_paid_user', requireLogin, async (req, res) => {
  await saveJob(req, res);
});

async function saveJob(req, res) {
  try {
    const sanitizedTitle = sanitizeHtml(req.body.title || '').trim();
    if (!sanitizedTitle) throw new Error('❌ Job Title is required');

    const cleanDescription = sanitizeHtml(req.body._description || '', {
      allowedTags: ['p', 'strong', 'em', 'ul', 'li', 'ol', 'br'],
      allowedAttributes: {}
    });

    const newJob = new JobVacancy({
      title: sanitizedTitle,
      _label: sanitizedTitle,
      country: req.body.country,
      studentType: req.body.studentType,
      teachingArea: req.body.teachingArea,
      duration: req.body.duration,
      pay: req.body.pay,
      housing: req.body.housing,
      email: req.body.email,
      companyName: req.body.companyName,
      jobLocation: req.body.jobLocation,
      cellphoneNumber: req.body.cellphoneNumber,
      skypeId: req.body.skypeId,
      wechatId: req.body.wechatId,
      homepage: req.body.homepage,
      adPackage: req.body.adPackage,
      addResumeAccess: req.body.addResumeAccess === 'yes',
      _description: cleanDescription
    });

    await newJob.save();

    const facetEntry = createFacetEntryFromCRUD(newJob);
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    await client.db('eventpool').collection('esl').insertOne(facetEntry);
    await client.close();

    res.redirect('/facet/Job_Vacancies');
  } catch (err) {
    console.error("❌ Error saving job vacancy:", err.message || err);
    res.status(500).send(err.message || 'Error saving job vacancy');
  }
}

router.get('/:id', requireLogin, async (req, res) => {
  const jobVacancy = await JobVacancy.findById(req.params.id);
  if (!jobVacancy) return res.status(404).send('Job not found');

  const stripped = sanitizeHtml(jobVacancy._description || '', {
    allowedTags: [],
    allowedAttributes: {}
  });

  res.render('jobVacancy/show', { jobVacancy, stripped });
});

router.get('/:id/edit', requireLogin, async (req, res) => {
  const jobVacancy = await JobVacancy.findById(req.params.id);
  const [studentTypes, countries, teachingAreas] = await Promise.all([
    JobVacancy.distinct('studentType'),
    JobVacancy.distinct('country'),
    JobVacancy.distinct('teachingArea')
  ]);
  res.render('jobVacancy/edit', { jobVacancy, studentTypes, countries, teachingAreas });
});

router.put('/:id', requireLogin, async (req, res) => {
  const sanitizedTitle = sanitizeHtml(req.body.title || '').trim();
  if (!sanitizedTitle) return res.status(400).send('Job Title is required');

  const cleanDescription = sanitizeHtml(req.body._description || '', {
    allowedTags: ['p', 'strong', 'em', 'ul', 'li', 'ol', 'br'],
    allowedAttributes: {}
  });

  await JobVacancy.findByIdAndUpdate(req.params.id, {
    title: sanitizedTitle,
    _label: sanitizedTitle,
    country: req.body.country,
    studentType: req.body.studentType,
    teachingArea: req.body.teachingArea,
    duration: req.body.duration,
    pay: req.body.pay,
    housing: req.body.housing,
    email: req.body.email,
    companyName: req.body.companyName,
    jobLocation: req.body.jobLocation,
    cellphoneNumber: req.body.cellphoneNumber,
    homepage: req.body.homepage,
    adPackage: req.body.adPackage,
    addResumeAccess: req.body.addResumeAccess === 'yes',
    _description: cleanDescription
  });

  res.redirect('/facet/Job_Vacancies');
});

router.delete('/:id', requireLogin, async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/facet/Job_Vacancies');
});

module.exports = router;
