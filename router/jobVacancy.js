console.log("✅ jobVacancyRouter loaded");
const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { requireEmployer } = require('../middleware/requireEmployer');



// ✅ RDF 처리 함수
const {
  translateJobVacancyToRDF,
  saveRDFToFile
} = require('../rdf_translator');

// ✅ 전체 목록 보기
router.get('/', async (req, res) => {
  try {
    const jobVacancies = await JobVacancy.find().sort({ createdAt: -1 });
    res.render('jobVacancy/index', { jobVacancies });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// ✅ 신규 작성 폼
router.get('/new', requireLogin, async (req, res) => {
  try {
    const countries = await JobVacancy.distinct('country');
    const studentTypes = await JobVacancy.distinct('studentType');
    const teachingAreas = await JobVacancy.distinct('teachingArea');
    res.render('jobVacancy/new', {
      countries,
      studentTypes,
      teachingAreas
    });
  } catch (err) {
    console.error('❌ Error loading form:', err);
    res.status(500).send('Form error');
  }
});

// ✅ Paid User 전용 신규 등록 폼
router.get('/new_paid_user', requireLogin, requireEmployer, async (req, res) => {
  console.log("✅ req.user in new_paid_user route:", req.user);
  try {
    const [studentTypesFromDB, countriesFromDB, teachingAreasFromDB] = await Promise.all([
      JobVacancy.distinct('studentType'),
      JobVacancy.distinct('country'),
      JobVacancy.distinct('teachingArea')
    ]);

    res.render('jobVacancy/new_paid_user', {
      jobVacancy: {}, // 필수: pug 템플릿에서 참조
      studentTypes: studentTypesFromDB,
      countries: countriesFromDB,
      teachingAreas: teachingAreasFromDB
    });
  } catch (err) {
    console.error('❌ Error loading paid user form:', err);
    res.status(500).send('Form error');
  }
});

// ✅ POST /new_paid_user 처리
router.post('/new_paid_user', requireLogin, requireEmployer, async (req, res) => {
  try {
    const job = new JobVacancy();

    // ✅ 필드 처리 (new에서 했던 것과 동일하게)
    job.title = sanitizeHtml(req.body.title);
    job.description = sanitizeHtml(req.body.description, { allowedTags: false });
    job.country = req.body.country || req.body.customCountry;
    job.studentType = req.body.studentType || req.body.customStudentType;
    job.teachingArea = req.body.teachingArea || req.body.customTeachingArea;
    job.duration = req.body.duration;
    job.pay = req.body.pay;
    job.housing = req.body.housing;
    job.adPackage = req.body.adPackage;
    job.addResumeAccess = req.body.addResumeAccess === 'on';
    job.companyName = req.body.companyName;
    job.jobLocation = req.body.jobLocation;
    job.datePosted = new Date();
    job.email = req.body.email;
    job.cellphoneNumber = req.body.cellphoneNumber;
    job.skypeId = req.body.skypeId;
    job.wechatId = req.body.wechatId;
    job.homepage = req.body.homepage;
    job.user = req.user._id;

    await job.save();

    // ✅ RDF 저장
    const store = translateJobVacancyToRDF(job);
    const filePath = path.join(__dirname, `../rdf/job_${job._id}.ttl`);
    await saveRDFToFile(store, filePath);

    res.redirect(`/job-vacancies/${job._id}?success=true`);
  } catch (err) {
    console.error('❌ new_paid_user 등록 실패:', err);
    res.status(500).send('등록 실패');
  }
});


// ✅ 등록 처리 + RDF 저장
router.post('/new', requireLogin, async (req, res) => {
  try {
    const job = new JobVacancy();

    // ✅ 기본 필드 처리
    job.title = sanitizeHtml(req.body.title);
    job.description = sanitizeHtml(req.body.description, { allowedTags: false });
    job.country = req.body.country || req.body.customCountry;
    job.studentType = req.body.studentType || req.body.customStudentType;
    job.teachingArea = req.body.teachingArea || req.body.customTeachingArea;
    job.duration = req.body.duration;
    job.pay = req.body.pay;
    job.housing = req.body.housing;
    job.adPackage = req.body.adPackage;
    job.addResumeAccess = req.body.addResumeAccess === 'on';

    // ✅ 회사/연락처 정보
    job.companyName = req.body.companyName;
    job.jobLocation = req.body.jobLocation;
    job.datePosted = new Date();
    job.email = req.body.email;
    job.cellphoneNumber = req.body.cellphoneNumber;
    job.skypeId = req.body.skypeId;
    job.wechatId = req.body.wechatId;
    job.homepage = req.body.homepage;

    // ✅ 작성자
    job.user = req.user._id;

    // ✅ 저장
    await job.save();

    // ✅ RDF 변환 및 저장
    const store = translateJobVacancyToRDF(job);
    const filePath = path.join(__dirname, `../rdf/job_${job._id}.ttl`);
    await saveRDFToFile(store, filePath);

    res.redirect(`/job-vacancies/${job._id}?success=true`);
  } catch (err) {
    console.error('❌ Job creation failed:', err);
    res.status(500).send('Job creation failed');
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

    res.render('jobVacancy/edit', {
      jobVacancy,
      countries,
      studentTypes,
      teachingAreas
    });
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

    job.title = sanitizeHtml(req.body.title);
    job.description = sanitizeHtml(req.body.description, { allowedTags: false });
    job.country = req.body.country || req.body.customCountry;
    job.studentType = req.body.studentType || req.body.customStudentType;
    job.teachingArea = req.body.teachingArea || req.body.customTeachingArea;
    job.duration = req.body.duration;
    job.pay = req.body.pay;
    job.housing = req.body.housing;
    job.adPackage = req.body.adPackage;
    job.addResumeAccess = req.body.addResumeAccess === 'on';
    job.companyName = req.body.companyName;
    job.jobLocation = req.body.jobLocation;
    job.email = req.body.email;
    job.cellphoneNumber = req.body.cellphoneNumber;
    job.skypeId = req.body.skypeId;
    job.wechatId = req.body.wechatId;
    job.homepage = req.body.homepage;

    await job.save();

    // ✅ RDF도 업데이트
    const store = translateJobVacancyToRDF(job);
    const filePath = path.join(__dirname, `../rdf/job_${job._id}.ttl`);
    await saveRDFToFile(store, filePath);

    res.redirect(`/job-vacancies/${job._id}`);
  } catch (err) {
    console.error('❌ Update failed:', err);
    res.status(500).send('Update failed');
  }
});

// ✅ 삭제 처리
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const job = await JobVacancy.findByIdAndDelete(req.params.id);

    // ✅ RDF 파일도 삭제
    const rdfPath = path.join(__dirname, `../rdf/job_${req.params.id}.ttl`);
    if (fs.existsSync(rdfPath)) fs.unlinkSync(rdfPath);

    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('❌ Delete failed:', err);
    res.status(500).send('Delete failed');
  }
});

module.exports = router;
