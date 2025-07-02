const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { createFacetEntryFromCRUD } = require('../utils/createFacetEntry');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

router.get('/', async (req, res) => {
  const jobVacancies = await JobVacancy.find().sort({ createdAt: -1 });
  res.render('jobVacancy/index', { jobVacancies });
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

    const newJob = new JobVacancy({
      title: sanitizedTitle,
      _label: sanitizedTitle,
      country: req.body.country,
      studentType: req.body.studentType,
      teachingArea: req.body.teachingArea,
      duration: req.body.duration
    });
    await newJob.save();

    const facetEntry = createFacetEntryFromCRUD(newJob);
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    await client.db('eventpool').collection('esl').insertOne(facetEntry);
    await client.close();

    res.redirect('/job-vacancies');
  } catch (err) {
    console.error("❌ Error saving job vacancy:", err.message || err);
    res.status(500).send(err.message || 'Error saving job vacancy');
  }
}

router.get('/:id', async (req, res) => {
  const jobVacancy = await JobVacancy.findById(req.params.id);
  if (!jobVacancy) return res.status(404).send('Job not found');
  res.render('jobVacancy/show', { jobVacancy });
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

  await JobVacancy.findByIdAndUpdate(req.params.id, {
    title: sanitizedTitle,
    _label: sanitizedTitle,
    country: req.body.country,
    studentType: req.body.studentType,
    teachingArea: req.body.teachingArea,
    duration: req.body.duration
  });
  res.redirect('/job-vacancies');
});

router.delete('/:id', requireLogin, async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  res.redirect('/job-vacancies');
});

module.exports = router;
