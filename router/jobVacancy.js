const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { requireEmployer } = require('../middleware/requireEmployer');
const fs = require('fs');
const path = require('path');
const {
  translateJobVacancyToRDF,
  saveRDFToFile,
  storeToJSONLD,
  saveRDFToMongo
} = require('../rdf-translator');

// ✅ 전체 목록
router.get('/', async (req, res) => {
  try {
    const jobVacancies = await JobVacancy.find().sort({ createdAt: -1 });
    res.render('jobVacancy/index', { jobVacancies });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ✅ 신규 작성 폼 (일반 사용자)
router.get('/new', requireLogin, async (req, res) => {
  try {
    const countries = await JobVacancy.distinct('country');
    const studentTypes = await JobVacancy.distinct('studentType');
    const teachingAreas = await JobVacancy.distinct('teachingArea');
    res.render('jobVacancy/new', { countries, studentTypes, teachingAreas });
  } catch (err) {
    console.error('❌ Error loading form:', err);
    res.status(500).send('Form error');
  }
});

// ✅ 신규 작성 폼 (Paid User)
router.get('/new_paid_user', requireLogin, requireEmployer, async (req, res) => {
  try {
    const [studentTypes, countries, teachingAreas] = await Promise.all([
      JobVacancy.distinct('studentType'),
      JobVacancy.distinct('country'),
      JobVacancy.distinct('teachingArea')
    ]);

    res.render('jobVacancy/new_paid_user', {
      jobVacancy: {},
      studentTypes,
      countries,
      teachingAreas
    });
  } catch (err) {
    console.error('❌ Error loading paid user form:', err);
    res.status(500).send('Form error');
  }
});

// ✅ POST /new (일반 사용자)
router.post('/new', requireLogin, async (req, res) => {
  try {
    const job = new JobVacancy({
      title: sanitizeHtml(req.body.title),
      description: sanitizeHtml(req.body.description, { allowedTags: false }),
      country: req.body.country || req.body.customCountry,
      studentType: req.body.studentType || req.body.customStudentType,
      teachingArea: req.body.teachingArea || req.body.customTeachingArea,
      duration: req.body.duration,
      pay: req.body.pay,
      housing: req.body.housing,
      adPackage: req.body.adPackage,
      addResumeAccess: req.body.addResumeAccess === 'on',
      companyName: req.body.companyName,
      jobLocation: req.body.jobLocation,
      datePosted: new Date(),
      email: req.body.email,
      cellphoneNumber: req.body.cellphoneNumber,
      skypeId: req.body.skypeId,
      wechatId: req.body.wechatId,
      homepage: req.body.homepage,
      user: req.user._id
    });

    await job.save();

    const rdfStore = translateJobVacancyToRDF(job);
    const rdfPath = path.join(__dirname, `../public/rdf/${job._id}.ttl`);

    try {
      await saveRDFToFile(rdfStore, rdfPath);
      const jsonld = await storeToJSONLD(rdfStore);
      await saveRDFToMongo(jsonld);
      console.log(`✅ RDF 및 MongoDB 저장 성공`);
    } catch (rdfErr) {
      console.error(`❌ RDF 처리 실패: ${rdfErr.message}`);
    }

    res.redirect(`/job-vacancies/${job._id}?success=true`);
  } catch (err) {
    console.error('❌ Job creation failed:', err);
    res.status(500).send('Job creation failed');
  }
});

// ✅ POST /new_paid_user (Paid User)
router.post('/new_paid_user', requireLogin, requireEmployer, async (req, res) => {
  try {
    const job = new JobVacancy({
      title: sanitizeHtml(req.body.title),
      description: sanitizeHtml(req.body.description, { allowedTags: false }),
      country: req.body.country || req.body.customCountry,
      studentType: req.body.studentType || req.body.customStudentType,
      teachingArea: req.body.teachingArea || req.body.customTeachingArea,
      duration: req.body.duration,
      pay: req.body.pay,
      housing: req.body.housing,
      adPackage: req.body.adPackage,
      addResumeAccess: req.body.addResumeAccess === 'on',
      companyName: req.body.companyName,
      jobLocation: req.body.jobLocation,
      datePosted: new Date(),
      email: req.body.email,
      cellphoneNumber: req.body.cellphoneNumber,
      skypeId: req.body.skypeId,
      wechatId: req.body.wechatId,
      homepage: req.body.homepage,
      user: req.user._id
    });

    await job.save();

    const rdfStore = translateJobVacancyToRDF(job);
    const rdfPath = path.join(__dirname, `../public/rdf/${job._id}.ttl`);

    try {
      await saveRDFToFile(rdfStore, rdfPath);
      const jsonld = await storeToJSONLD(rdfStore);
      await saveRDFToMongo(jsonld);
      console.log(`✅ RDF 및 MongoDB 저장 성공`);
    } catch (rdfErr) {
      console.error(`❌ RDF 처리 실패: ${rdfErr.message}`);
    }

    res.redirect(`/job-vacancies/${job._id}?success=true`);
  } catch (err) {
    console.error('❌ Paid user job creation failed:', err);
    res.status(500).send('등록 실패');
  }
});

// ✅ 상세 보기
router.get('/:id', async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id).populate('user');
    const success = req.query.success === 'true';
    res.render('jobVacancy/show', { jobVacancy, success });
  } catch (err) {
    console.error('❌ Job not found:', err);
    res.status(404).send('Job not found');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id);
    if (!jobVacancy) return res.status(404).send('Job not found');

    const countries = await JobVacancy.distinct('country');
    const studentTypes = await JobVacancy.distinct('studentType');
    const teachingAreas = await JobVacancy.distinct('teachingArea');

    res.render('jobVacancy/edit', { jobVacancy, countries, studentTypes, teachingAreas });
  } catch (err) {
    console.error('❌ Error loading edit form:', err);
    res.status(500).send('Error');
  }
});

// ✅ 수정 처리
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const job = await JobVacancy.findById(req.params.id);
    if (!job) return res.status(404).send('Job not found');

    Object.assign(job, {
      title: sanitizeHtml(req.body.title),
      description: sanitizeHtml(req.body.description, { allowedTags: false }),
      country: req.body.country || req.body.customCountry,
      studentType: req.body.studentType || req.body.customStudentType,
      teachingArea: req.body.teachingArea || req.body.customTeachingArea,
      duration: req.body.duration,
      pay: req.body.pay,
      housing: req.body.housing,
      adPackage: req.body.adPackage,
      addResumeAccess: req.body.addResumeAccess === 'on',
      companyName: req.body.companyName,
      jobLocation: req.body.jobLocation,
      email: req.body.email,
      cellphoneNumber: req.body.cellphoneNumber,
      skypeId: req.body.skypeId,
      wechatId: req.body.wechatId,
      homepage: req.body.homepage
    });

    await job.save();

    const rdfStore = translateJobVacancyToRDF(job);
    const rdfPath = path.join(__dirname, `../public/rdf/${job._id}.ttl`);

    try {
      await saveRDFToFile(rdfStore, rdfPath);
      const jsonld = await storeToJSONLD(rdfStore);
      await saveRDFToMongo(jsonld);
      console.log(`✅ RDF 및 Mongo 업데이트 성공`);
    } catch (rdfErr) {
      console.error(`❌ RDF 업데이트 실패: ${rdfErr.message}`);
    }

    res.redirect(`/job-vacancies/${job._id}`);
  } catch (err) {
    console.error('❌ Update failed:', err);
    res.status(500).send('Update failed');
  }
});

// ✅ 삭제
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const job = await JobVacancy.findByIdAndDelete(req.params.id);
    const rdfPath = path.join(__dirname, `../public/rdf/${req.params.id}.ttl`);
    if (fs.existsSync(rdfPath)) fs.unlinkSync(rdfPath);
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('❌ Delete failed:', err);
    res.status(500).send('Delete failed');
  }
});

module.exports = router;
