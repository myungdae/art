// router/jobVacancy.js
const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const sanitizeHtml = require('sanitize-html');
const { requireLogin, requireRole, requirePaidEmployer } = require('../middleware/auth');
const { createFacetEntryFromCRUD } = require('../utils/createFacetEntry');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

/* -------------------------------------------
 * 유틸: distinct 목록 로드 + 폴백
 * ----------------------------------------- */
async function loadSelectLists() {
  const FALLBACK = {
    studentTypes: ['Kindergarten', 'Elementary', 'Middle', 'High', 'University', 'Adult'],
    countries: ['Korea', 'USA', 'Canada', 'UK', 'Australia'],
    teachingAreas: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gyeonggi'],
  };

  const safeDistinct = async field => {
    try {
      const arr = await JobVacancy.distinct(field);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const [studentTypesRaw, countriesRaw, teachingAreasRaw] = await Promise.all([
    safeDistinct('studentType'),
    safeDistinct('country'),
    safeDistinct('teachingArea'),
  ]);

  const studentTypes  = studentTypesRaw.length  ? studentTypesRaw.sort()  : FALLBACK.studentTypes;
  const countries     = countriesRaw.length     ? countriesRaw.sort()     : FALLBACK.countries;
  const teachingAreas = teachingAreasRaw.length ? teachingAreasRaw.sort() : FALLBACK.teachingAreas;

  return { studentTypes, countries, teachingAreas };
}

/* -------------------------------------------
 * /job-vacancies 루트: 로그인 유도 후 페싯으로
 * ----------------------------------------- */
router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/user/login');
  return res.redirect('/facet/Job_Vacancies');
});

/* -------------------------------------------
 * 신규 등록(기본 폼) - 유료 Employer만 접근
 * ----------------------------------------- */
router.get(
  '/new',
  requireLogin,
  requireRole('Employer'),
  requirePaidEmployer,
  async (req, res) => {
    const { studentTypes, countries, teachingAreas } = await loadSelectLists();
    res.render('jobVacancy/new', { studentTypes, countries, teachingAreas });
  }
);

/* -------------------------------------------
 * 신규 등록(유료 전용 별도 폼 유지 시) - 동일 보호/전달
 * ----------------------------------------- */
router.get(
  '/new_paid_user',
  requireLogin,
  requireRole('Employer'),
  requirePaidEmployer,
  async (req, res) => {
    const { studentTypes, countries, teachingAreas } = await loadSelectLists();
    res.render('jobVacancy/new_paid_user', { studentTypes, countries, teachingAreas });
  }
);

/* -------------------------------------------
 * 저장 공통
 * ----------------------------------------- */
router.post(
  '/new',
  requireLogin,
  requireRole('Employer'),
  requirePaidEmployer,
  async (req, res) => { await saveJob(req, res); }
);

router.post(
  '/new_paid_user',
  requireLogin,
  requireRole('Employer'),
  requirePaidEmployer,
  async (req, res) => { await saveJob(req, res); }
);

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
      country: req.body.country,              // 필요 시 customCountry 우선 사용 로직 추가 가능
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

    // 페싯 데이터 적재
    const facetEntry = createFacetEntryFromCRUD(newJob);
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    await client.db('eventpool').collection('esl').insertOne(facetEntry);
    await client.close();

    return res.redirect('/facet/Job_Vacancies');
  } catch (err) {
    console.error("❌ Error saving job vacancy:", err.message || err);
    return res.status(500).send(err.message || 'Error saving job vacancy');
  }
}

/* -------------------------------------------
 * 상세 보기
 * ----------------------------------------- */
router.get('/:id', requireLogin, async (req, res) => {
  const jobVacancy = await JobVacancy.findById(req.params.id);
  if (!jobVacancy) return res.status(404).send('Job not found');

  const stripped = sanitizeHtml(jobVacancy._description || '', { allowedTags: [], allowedAttributes: {} });
  res.render('jobVacancy/show', { jobVacancy, stripped });
});

/* -------------------------------------------
 * 수정 폼
 * ----------------------------------------- */
router.get('/:id/edit', requireLogin, async (req, res) => {
  const jobVacancy = await JobVacancy.findById(req.params.id);
  const { studentTypes, countries, teachingAreas } = await loadSelectLists();
  res.render('jobVacancy/edit', { jobVacancy, studentTypes, countries, teachingAreas });
});

/* -------------------------------------------
 * 수정 저장
 * ----------------------------------------- */
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

  return res.redirect('/facet/Job_Vacancies');
});

/* -------------------------------------------
 * 삭제
 * ----------------------------------------- */
router.delete('/:id', requireLogin, async (req, res) => {
  await JobVacancy.findByIdAndDelete(req.params.id);
  return res.redirect('/facet/Job_Vacancies');
});

module.exports = router;
