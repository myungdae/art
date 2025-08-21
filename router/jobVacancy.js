// router/jobVacancy.js
'use strict';

const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const JobVacancy = require('../model/jobVacancy');
const validateObjectId = require('../middleware/validateObjectId');
const { requireLogin, requireRole } = require('../middleware/auth');

router.use(methodOverride('_method'));

// :id 유효성 검사 (미들웨어 + 보조 방어)
router.param('id', validateObjectId('id'));
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    console.warn('[INVALID ID HIT]', req.method, req.originalUrl, 'id=', id);
    return res.status(404).send('Invalid ID');
  }
  next();
});

// 프리셋 (필요시 DB/Config로 대체)
const defaultCountries    = ['Korea', 'Japan', 'China', 'Malaysia', 'Thailand'];
const defaultStudentTypes = ['Adults', 'Elementary', 'High School', 'Kindergarten', 'Middle'];
const defaultTeaching     = ['Art', 'Biology', 'English', 'ESL', 'Social Studies', 'Spanish'];

/* ------------ helpers ------------ */

// body → 표준 페이로드
function normalizePayload(body) {
  const title =
    body['rdfs:label[@value]'] ??
    body._label ??
    body.title ??
    '';

  const description =
    body['http://purl.org/dc/elements/1.1/description[@value]'] ??
    body._description ??
    body.description ??
    '';

  // name="teachingArea" (multi) 또는 name="teachingArea[]" 모두 수용
  const rawTA = body.teachingArea ?? body['teachingArea[]'];

  const datePosted = body.datePosted ? new Date(body.datePosted) : null;

  return {
    title,
    description,
    country: body.country ?? '',
    studentType: body.studentType ?? '',
    teachingArea: rawTA, // string | string[]
    duration: body.duration ?? '',
    pay: body.pay ?? '',
    housing: body.housing ?? '',
    email: body.email ?? '',
    companyName: body.companyName ?? '',
    jobLocation: body.jobLocation ?? '',
    cellphoneNumber: body.cellphoneNumber ?? '',
    homepage: body.homepage ?? '',
    datePosted
  };
}

// teachingArea를 항상 "배열<string>"로 보정(트림 + 빈값 제거 + 중복 제거)
function toStringArray(v) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string') arr = [v];
  return Array.from(
    new Set(arr.map(s => (s ?? '').toString().trim()).filter(Boolean))
  );
}

// 폼의 추가 Teaching Area CSV 병합 (선택값 + CSV)
function mergeExtraAreas(arr, extraCsv) {
  const extra = (extraCsv || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...(arr || []), ...extra]));
}

// 간단 검증
function validatePayload(p) {
  const errors = {};

  if (!p.title || typeof p.title !== 'string') {
    errors.title = 'Title is required.';
  } else {
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const koreanRegex = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
    if (emojiRegex.test(p.title) || koreanRegex.test(p.title)) {
      errors.title = 'Emojis or Korean are not allowed in title.';
    }
  }

  if (!p.country)     errors.country = 'Host Country is required.';
  if (!p.studentType) errors.studentType = 'Student Type is required.';

  const taLen = toStringArray(p.teachingArea).length;
  if (!taLen) errors.teachingArea = 'Teaching Area is required.';

  return errors;
}

// facet용 RDF 미러(업서트)
// /facet/Job_Vacancies가 어떤 컬렉션을 읽는지 확실치 않아
// 'Job_Vacancies_RDF'에 기본 업서트 + 존재 시 'Job_Vacancies'에도 호환 업서트
async function mirrorToRDF(job) {
  const doc = {
    _id: job._id, // RDF 쪽에서 _id로 맵핑(=jobId 대체)
    _label: job._label || job.title || '',
    _description: job._description || job.description || '',
    title: job.title || '',
    country: job.country || '',
    studentType: job.studentType || '',
    teachingArea: Array.isArray(job.teachingArea)
      ? job.teachingArea
      : (job.teachingArea ? [job.teachingArea] : []),
    duration: job.duration || '',
    pay: job.pay || '',
    housing: job.housing || '',
    email: job.email || '',
    companyName: job.companyName || '',
    jobLocation: job.jobLocation || '',
    cellphoneNumber: job.cellphoneNumber || '',
    homepage: job.homepage || '',
    datePosted: job.datePosted || new Date(),
    user: job.user || null,
    _class: 'Job_Vacancies',
    updatedAt: new Date()
  };

  const db = mongoose.connection.db;

  await db.collection('Job_Vacancies_RDF').updateOne(
    { _id: job._id },
    { $set: doc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  try {
    await db.collection('Job_Vacancies').updateOne(
      { _id: job._id },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    // 호환 컬렉션이 없으면 무시
  }
}

/* ------------ routes ------------ */

// New (form)
router.get('/job-vacancies/new',
  requireLogin,
  requireRole('Employer'),
  (req, res) => {
    res.render('jobVacancy/new', {
      countries: defaultCountries,
      studentTypes: defaultStudentTypes,
      teachingAreas: defaultTeaching,
      values: {},
      errors: {}
    });
  }
);

// Create
router.post('/job-vacancies',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    try {
      const payload = normalizePayload(req.body);
      const errors  = validatePayload(payload);
      let taOut     = toStringArray(payload.teachingArea);
      taOut         = mergeExtraAreas(taOut, req.body.extraTeachingArea);

      if (Object.keys(errors).length) {
        return res.status(422).render('jobVacancy/new', {
          countries: defaultCountries,
          studentTypes: defaultStudentTypes,
          teachingAreas: defaultTeaching,
          values: {
            ...payload,
            teachingArea: taOut,
            extraTeachingArea: req.body.extraTeachingArea || '',
            _labelOverride: req.body._labelOverride || '',
            _descriptionOverride: req.body._descriptionOverride || ''
          },
          errors
        });
      }

      const title        = (payload.title || '').trim();
      const contactEmail = payload.email || (req.session?.user?.email || '');
      const _label       = (req.body._labelOverride || title).trim();
      const _description = (req.body._descriptionOverride || payload.description || '').trim();

      const doc = new JobVacancy({
        ...payload,
        user: req.session.user._id,  // 소유자
        teachingArea: taOut,         // [String]
        title,
        _label,
        _description,
        email: contactEmail,
        datePosted: payload.datePosted || new Date()
      });

      await doc.save();
      await mirrorToRDF(doc);

      req.flash?.('success', 'Job vacancy created.');
      console.log('→ redirect: /facet/Job_Vacancies (create)');
      return res.redirect('/facet/Job_Vacancies');

    } catch (err) {
      // 사용자+제목 unique 인덱스 충돌 처리 (E11000)
      if (err && err.code === 11000) {
        return res.status(409).render('jobVacancy/new', {
          countries: defaultCountries,
          studentTypes: defaultStudentTypes,
          teachingAreas: defaultTeaching,
          values: {
            ...req.body,
            teachingArea: toStringArray(req.body.teachingArea),
            extraTeachingArea: req.body.extraTeachingArea || ''
          },
          errors: { title: 'You already have a job with this title.' }
        });
      }
      console.error('[CREATE] job-vacancy error:', err);
      return res.status(500).render('error', { message: 'Failed to create job vacancy', error: err });
    }
  }
);

// Edit (form)
router.get('/job-vacancies/:id/edit',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    const { id } = req.params;
    const jobVacancy = await JobVacancy.findById(id);
    if (!jobVacancy) return res.status(404).send('Not found');

    res.render('jobVacancy/edit', {
      jobVacancy,
      countries: defaultCountries,
      studentTypes: defaultStudentTypes,
      teachingAreas: defaultTeaching,
      errors: {}
    });
  }
);

// List (public)
router.get('/job-vacancies', async (req, res, next) => {
  try {
    // /job-vacancies?country=Korea&studentType=Adult&teachingArea=English
    const { country, studentType, teachingArea } = req.query;
    const q = {};
    if (country)     q.country = country;
    if (studentType) q.studentType = studentType;
    if (teachingArea) {
      // 배열 요소 매치 + 혹시 남아있을 문자열 문서 대비
      q.$or = [
        { teachingArea: teachingArea },
        { teachingArea: { $regex: teachingArea, $options: 'i' } }
      ];
    }

    const jobs = await JobVacancy.find(q)
      .sort({ datePosted: -1, createdAt: -1 })
      .limit(200)
      .lean();

    return res.render('jobVacancy/index', {
      jobs,
      filters: {
        country: country || '',
        studentType: studentType || '',
        teachingArea: teachingArea || ''
      }
    });
  } catch (err) {
    console.error('GET /job-vacancies error:', err);
    return next(err);
  }
});

// List (mine)
router.get('/job-vacancies/mine',
  requireLogin,
  requireRole('Employer'),
  async (req, res, next) => {
    try {
      const jobs = await JobVacancy.find({ user: req.session.user._id })
        .sort({ datePosted: -1, createdAt: -1 })
        .lean();

      return res.render('jobVacancy/mine', { jobs });
    } catch (err) {
      console.error('GET /job-vacancies/mine error:', err);
      return next(err);
    }
  }
);

// Update
router.put('/job-vacancies/:id',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    const { id } = req.params;
    try {
      const payload = normalizePayload(req.body);
      const errors  = validatePayload(payload);
      let taOut     = toStringArray(payload.teachingArea);
      taOut         = mergeExtraAreas(taOut, req.body.extraTeachingArea);

      if (Object.keys(errors).length) {
        const jobVacancy = await JobVacancy.findById(id);
        return res.status(422).render('jobVacancy/edit', {
          jobVacancy: {
            ...(jobVacancy ? jobVacancy.toObject() : {}),
            ...payload,
            teachingArea: taOut,
            extraTeachingArea: req.body.extraTeachingArea || ''
          },
          countries: defaultCountries,
          studentTypes: defaultStudentTypes,
          teachingAreas: defaultTeaching,
          errors
        });
      }

      const title        = (payload.title || '').trim();
      const _label       = (req.body._labelOverride || title).trim();
      const _description = (req.body._descriptionOverride || payload.description || '').trim();

      const updated = await JobVacancy.findByIdAndUpdate(
        id,
        {
          ...payload,
          teachingArea: taOut,   // [String]
          title,
          _label,
          _description,
          datePosted: payload.datePosted || new Date()
        },
        { new: true, runValidators: true }
      );

      if (updated) await mirrorToRDF(updated);

      req.flash?.('success', 'Job vacancy updated.');
      console.log('→ redirect: /facet/Job_Vacancies (update)');
      return res.redirect('/facet/Job_Vacancies');
    } catch (err) {
      console.error('[UPDATE] job-vacancy error:', err);
      return res.status(500).render('error', { message: 'Failed to update job vacancy', error: err });
    }
  }
);

module.exports = router;
