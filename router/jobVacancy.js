const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { translateJobVacancyToRDF, storeToJSONLD, saveRDFToMongo } = require('../rdf-translator');
const { createFacetEntryFromCRUD } = require('../utils/createFacetEntry');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';


// ✅ 전체 리스트
router.get('/', async (req, res) => {
  try {
    const jobVacancies = await JobVacancy.find().sort({ createdAt: -1 });
    res.render('jobVacancy/index', { jobVacancies });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ✅ 신규 등록 폼
router.get('/new', requireLogin, (req, res) => {
  res.render('jobVacancy/new');
});

// ✅ 유료 사용자 전용 신규 등록 폼
router.get('/new_paid_user', requireLogin, async (req, res) => {
  try {
    const [studentTypesFromDB, countriesFromDB, teachingAreasFromDB] = await Promise.all([
      JobVacancy.distinct('studentType'),
      JobVacancy.distinct('country'),
      JobVacancy.distinct('teachingArea')
    ]);

    res.render('jobVacancy/new_paid_user', {
      studentTypes: studentTypesFromDB,
      countries: countriesFromDB,
      teachingAreas: teachingAreasFromDB
    });
  } catch (err) {
    console.error('Error loading new_paid_user form:', err);
    res.status(500).send('Error loading form');
  }
});

// ✅ 등록 처리 + RDF 자동 저장
router.post('/new', requireLogin, async (req, res) => {
  try {
    const sanitizedTitle = sanitizeHtml(req.body.title);
    const newJob = new JobVacancy({
      title: sanitizedTitle,
      country: req.body.country,
      studentType: req.body.studentType,
      teachingArea: req.body.teachingArea,
      duration: req.body.duration
    });
    await newJob.save();

    console.log("✅ JobVacancy saved:", newJob.title);

    // ✅ RDF entry 생성 및 저장
    const facetEntry = createFacetEntryFromCRUD(newJob);
    console.log("✅ Creating RDF entry:", facetEntry);

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('eventpool');
    const col = db.collection('esl');
    await col.insertOne(facetEntry);
    console.log("✅ Inserted RDF to MongoDB:", facetEntry["@id"]);
    await client.close();

    res.redirect('/job-vacancies');
  } catch (err) {
    console.error("❌ Error saving job vacancy or RDF insert:", err);
    res.status(500).send('Error saving job vacancy');
  }
});


// ✅ 상세 보기
router.get('/:id', async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id);
    if (!jobVacancy) return res.status(404).send('Job not found');
    res.render('jobVacancy/show', { jobVacancy });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving job');
  }
});

// ✅ 수정 폼 (드롭다운 값 포함)
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id);
    if (!jobVacancy) return res.status(404).send('Job not found');

    const [studentTypesFromDB, countriesFromDB, teachingAreasFromDB] = await Promise.all([
      JobVacancy.distinct('studentType'),
      JobVacancy.distinct('country'),
      JobVacancy.distinct('teachingArea')
    ]);

    res.render('jobVacancy/edit', {
      jobVacancy,
      studentTypes: studentTypesFromDB,
      countries: countriesFromDB,
      teachingAreas: teachingAreasFromDB
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading edit form');
  }
});

// ✅ 수정 처리
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const sanitizedTitle = sanitizeHtml(req.body.title);
    await JobVacancy.findByIdAndUpdate(req.params.id, {
      title: sanitizedTitle,
      country: req.body.country,
      studentType: req.body.studentType,
      teachingArea: req.body.teachingArea,
      duration: req.body.duration
    });
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating job vacancy');
  }
});

// ✅ 삭제
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    await JobVacancy.findByIdAndDelete(req.params.id);
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting job vacancy');
  }
});

// ✅ RDF 변환 수동 실행 (테스트용)
router.get('/rdf/convert/:id', async (req, res) => {
  try {
    const job = await JobVacancy.findById(req.params.id);
    if (!job) return res.status(404).send('Job not found');

    const store = translateJobVacancyToRDF(job);
    const jsonld = await storeToJSONLD(store);
    await saveRDFToMongo(jsonld);

    res.json({ success: true, message: 'RDF converted and saved', id: job._id });
  } catch (err) {
    console.error(err);
    res.status(500).send('RDF conversion error');
  }
});

module.exports = router;
