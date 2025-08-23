'use strict';

const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const JobVacancy = require('../model/jobVacancy');
const validateObjectId = require('../middleware/validateObjectId');
const { requireLogin, requireRole } = require('../middleware/auth');

router.use(methodOverride('_method'));

// :id 유효성 검사
router.param('id', validateObjectId('id'));
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    console.warn('[INVALID ID HIT]', req.method, req.originalUrl, 'id=', id);
    return res.status(404).send('Invalid ID');
  }
  next();
});

/* ------------ helpers ------------ */

// payload 정규화
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

  const rawTA = body.teachingArea ?? body['teachingArea[]'];
  const datePosted = body.datePosted ? new Date(body.datePosted) : null;

  return {
    title,
    description,
    country: body.country ?? '',
    studentType: body.studentType ?? '',
    teachingArea: rawTA,
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

// teachingArea 배열 보정
function toStringArray(v) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string') arr = [v];
  return Array.from(
    new Set(arr.map(s => (s ?? '').toString().trim()).filter(Boolean))
  );
}

// 추가 Teaching Area CSV 병합
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

// facet용 RDF 미러
// facet용 RDF 미러 (드롭인 교체본)
// - @id 필드는 사용하지 않음(중복 인덱스 충돌 방지)
// - 과거 문서에 남아 있을 수 있는 @id는 매 업데이트 때 제거
async function mirrorToRDF(job) {
  const doc = {
    _id: job._id,                               // Mongo PK만 사용
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

  // ✅ RDF 미러 컬렉션
  await db.collection('Job_Vacancies_RDF').updateOne(
    { _id: job._id },
    {
      $set: doc,
      $setOnInsert: { createdAt: new Date() },
      $unset: { '@id': '' }       // 과거 잔여 필드 제거
    },
    { upsert: true }
  );

  // ✅ 호환 컬렉션(있으면 업데이트, 없으면 무시)
  try {
    await db.collection('Job_Vacancies').updateOne(
      { _id: job._id },
      {
        $set: doc,
        $setOnInsert: { createdAt: new Date() },
        $unset: { '@id': '' }     // 과거 잔여 필드 제거
      },
      { upsert: true }
    );
  } catch (_) {
    // 컬렉션 없으면 조용히 통과
  }
}


// ✅ Country 리스트 반환 API
router.get('/countries', async (req, res) => {
  try {
    const countries = await JobVacancy.distinct("country");
    res.json(countries.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------ routes ------------ */

// New (form)
router.get('/job-vacancies/new',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    const countries    = await JobVacancy.distinct("country");
    const studentTypes = await JobVacancy.distinct("studentType");
    const teaching     = await JobVacancy.distinct("teachingArea");

    res.render('jobVacancy/new', {
      countries: countries.sort(),
      studentTypes: studentTypes.sort(),
      teachingAreas: teaching.sort(),
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
        const countries    = await JobVacancy.distinct("country");
        const studentTypes = await JobVacancy.distinct("studentType");
        const teaching     = await JobVacancy.distinct("teachingArea");

        return res.status(422).render('jobVacancy/new', {
          countries: countries.sort(),
          studentTypes: studentTypes.sort(),
          teachingAreas: teaching.sort(),
          values: {
            ...payload,
            teachingArea: taOut,
            extraTeachingArea: req.body.extraTeachingArea || ''
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
        user: req.session.user._id,
        teachingArea: taOut,
        title,
        _label,
        _description,
        email: contactEmail,
        datePosted: payload.datePosted || new Date()
      });

      await doc.save();
      await mirrorToRDF(doc);

      req.flash?.('success', 'Job vacancy created.');
      return res.redirect('/facet/Job_Vacancies');

    } catch (err) {
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

    const countries    = await JobVacancy.distinct("country");
    const studentTypes = await JobVacancy.distinct("studentType");
    const teaching     = await JobVacancy.distinct("teachingArea");

    res.render('jobVacancy/edit', {
      jobVacancy,
      countries: countries.sort(),
      studentTypes: studentTypes.sort(),
      teachingAreas: teaching.sort(),
      errors: {}
    });
  }
);

// List (public)
router.get('/job-vacancies', async (req, res, next) => {
  try {
    const { country, studentType, teachingArea } = req.query;
    const q = {};
    if (country)     q.country = country;
    if (studentType) q.studentType = studentType;
    if (teachingArea) {
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
      filters: { country: country || '', studentType: studentType || '', teachingArea: teachingArea || '' }
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
        const countries    = await JobVacancy.distinct("country");
        const studentTypes = await JobVacancy.distinct("studentType");
        const teaching     = await JobVacancy.distinct("teachingArea");

        const jobVacancy = await JobVacancy.findById(id);

        return res.status(422).render('jobVacancy/edit', {
          jobVacancy: {
            ...(jobVacancy ? jobVacancy.toObject() : {}),
            ...payload,
            teachingArea: taOut,
            extraTeachingArea: req.body.extraTeachingArea || ''
          },
          countries: countries.sort(),
          studentTypes: studentTypes.sort(),
          teachingAreas: teaching.sort(),
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
          teachingArea: taOut,
          title,
          _label,
          _description,
          datePosted: payload.datePosted || new Date()
        },
        { new: true, runValidators: true }
      );

      if (updated) await mirrorToRDF(updated);

      req.flash?.('success', 'Job vacancy updated.');
      return res.redirect('/facet/Job_Vacancies');
    } catch (err) {
      console.error('[UPDATE] job-vacancy error:', err);
      return res.status(500).render('error', { message: 'Failed to update job vacancy', error: err });
    }
  }
);

module.exports = router;
