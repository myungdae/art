'use strict';

const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const mongoose = require('mongoose');

const JobVacancy = require('../model/jobVacancy');
const User = require('../model/user');
const defaultTeachingAreas = require('../config/teachingAreaConfig');

const validateObjectId = require('../middleware/validateObjectId');
const { requireLogin, requireRole } = require('../middleware/auth');
const { validateFields, validateHtmlContent } = require('../utils/contentValidator');

/* ------------ Standard Country List ------------ */
const STANDARD_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
  'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hong Kong', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Macau', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
  'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe'
];

router.use(methodOverride('_method'));

// :id 유효성 검사 (중복 핸들러 제거, 이 한 줄만 사용)
router.param('id', validateObjectId('id'));

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

// 간단 검증 (Enhanced with content validation)
function validatePayload(p) {
  const errors = {};

  // Required fields
  if (!p.title || typeof p.title !== 'string') {
    errors.title = 'Title is required.';
  }
  if (!p.country)     errors.country = 'Host Country is required.';
  if (!p.studentType) errors.studentType = 'Student Type is required.';

  const taLen = toStringArray(p.teachingArea).length;
  if (!taLen) errors.teachingArea = 'Teaching Area is required.';

  // Content validation for text fields
  const textFields = ['title', 'companyName', 'jobLocation', 'pay', 'housing'];
  const contentErrors = validateFields(p, textFields);
  Object.assign(errors, contentErrors);

  // Validate HTML description
  if (p.description) {
    const descError = validateHtmlContent(p.description);
    if (descError) {
      errors.description = descError;
    }
  }

  return errors;
}

// facet용 RDF 미러
async function mirrorToRDF(job) {
  const doc = {
    _id: job._id,
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
    {
      $set: doc,
      $setOnInsert: { createdAt: new Date() },
      $unset: { '@id': '' }
    },
    { upsert: true }
  );

  try {
    await db.collection('Job_Vacancies').updateOne(
      { _id: job._id },
      {
        $set: doc,
        $setOnInsert: { createdAt: new Date() },
        $unset: { '@id': '' }
      },
      { upsert: true }
    );
  } catch (_) {
    // 호환 컬렉션 없으면 무시
  }
}

// ✅ 광고 크레딧 확인 미들웨어
async function ensureAdCredit(req, res, next) {
  try {
    const u = await User.findById(req.session.user._id).select('adsAvailable').lean();
    const credits = u?.adsAvailable || 0;
    if (credits <= 0) {
      // 결제 유도
      return res.redirect('/paddle/checkout');
    }
    return next();
  } catch (e) {
    console.error('[ensureAdCredit] error:', e);
    return res.status(500).send('Failed to check ad credits');
  }
}

// ✅ Country 리스트 반환 API (표준 국가 목록 사용)
router.get('/countries', async (req, res) => {
  try {
    res.json(STANDARD_COUNTRIES);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------ routes ------------ */

// New (form) — 크레딧이 있어야 접근 가능
router.get(
  '/job-vacancies/new',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    // 크레딧 체크
    const me = await User.findById(req.session.user._id).select('adsAvailable').lean();
    const credits = Number(me?.adsAvailable || 0);
    if (credits <= 0) {
      // 결제 플로우로
      return res.redirect('/paddle/checkout?type=employer');
    }

    const studentTypes = await JobVacancy.distinct("studentType");
    const teaching     = await JobVacancy.distinct("teachingArea");

    // Merge DB values with defaults
    const allTeachingAreas = Array.from(new Set([...defaultTeachingAreas, ...teaching]));

    return res.render('jobVacancy/new', {
      countries: STANDARD_COUNTRIES,
      studentTypes: studentTypes.sort(),
      teachingAreas: allTeachingAreas.sort(),
      values: {},
      errors: {}
    });
  }
);


// 별칭(마이페이지에서 사용)
router.get(
  '/job-vacancies/new_paid_user',
  requireLogin,
  requireRole('Employer'),
  ensureAdCredit,
  (req, res) => res.redirect('/job-vacancies/new')
);

// Create — 원자적 차감 + 실패 시 롤백
router.post(
  '/job-vacancies',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    // 1) 차감 먼저 시도 (경쟁 조건 방지)
    const userId = req.session.user._id;
    const dec = await User.findOneAndUpdate(
      { _id: userId, adsAvailable: { $gt: 0 } },
      { $inc: { adsAvailable: -1 } },
      { new: true }
    );

    if (!dec) {
      // 크레딧 없음 → 결제 페이지로
      return res.redirect('/paddle/checkout');
    }

    try {
      const payload = normalizePayload(req.body);
      const errors  = validatePayload(payload);
      let taOut     = toStringArray(payload.teachingArea);
      taOut         = mergeExtraAreas(taOut, req.body.extraTeachingArea);

      if (Object.keys(errors).length) {
        const [studentTypes, teaching] = await Promise.all([
          JobVacancy.distinct('studentType'),
          JobVacancy.distinct('teachingArea'),
        ]);

        // ❗폼 에러면 차감 롤백
        await User.findByIdAndUpdate(userId, { $inc: { adsAvailable: +1 } });

        return res.status(422).render('jobVacancy/new', {
          countries: STANDARD_COUNTRIES,
          studentTypes: (studentTypes || []).filter(Boolean).sort(),
          teachingAreas: (teaching || []).filter(Boolean).sort(),
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
        user: userId,
        teachingArea: taOut,
        title,
        _label,
        _description,
        email: contactEmail,
        datePosted: payload.datePosted || new Date()
      });

      await doc.save();
      await User.findByIdAndUpdate(req.session.user._id, { $inc: { adsAvailable: -1 } });
      await mirrorToRDF(doc);

      req.flash?.('success', 'Job vacancy created.');
      return res.redirect('/job-vacancies/mine');

    } catch (err) {
      console.error('[CREATE] job-vacancy error:', err);
      // 실패 롤백
      await User.findByIdAndUpdate(userId, { $inc: { adsAvailable: +1 } });
      return res
        .status(500)
        .render('error', { message: 'Failed to create job vacancy', error: err });
    }
  }
);

router.get(
  '/job-vacancies/mine',
  requireLogin,
  requireRole('Employer'),
  async (req, res, next) => {
    try {
      const jobs = await JobVacancy.find({ user: req.session.user._id })
        .sort({ datePosted: -1, createdAt: -1 })
        .lean();

      return res.render('jobVacancy/index', {
        jobs,
        filters: { mine: true, country: '', studentType: '', teachingArea: '' },
        countries: [],
        studentTypes: [],
        teachingAreas: [],
      });
    } catch (err) {
      console.error('GET /job-vacancies/mine error:', err);
      return next(err);
    }
  }
);


// 내 공고 목록(고용주 전용)
router.get(
  '/job-vacancies/mine',
  requireLogin,
  requireRole('Employer'),
  async (req, res, next) => {
    try {
      const jobs = await JobVacancy.find({ user: req.session.user._id })
        .sort({ datePosted: -1, createdAt: -1 })
        .lean();

      res.render('jobVacancy/mine', { jobs });
    } catch (e) {
      next(e);
    }
  }
);

// Edit (form)
router.get(
  '/job-vacancies/:id/edit',
  requireLogin,
  async (req, res) => {
    const { id } = req.params;
    // Try to find in both collections (job_vacancies and Job_Vacancies_RDF)
    let jobVacancy = await JobVacancy.findById(id);
    
    // If not found in job_vacancies, try RDF collection
    if (!jobVacancy) {
      const db = mongoose.connection.db;
      const rdfDoc = await db.collection('Job_Vacancies_RDF').findOne({ 
        _id: new mongoose.Types.ObjectId(id) 
      });
      if (rdfDoc) {
        // Convert RDF document to JobVacancy-like object
        jobVacancy = rdfDoc;
      }
    }
    
    if (!jobVacancy) return res.status(404).send('Not found');

    // Check if user is owner or admin
    const currentUser = req.user;
    const isAdmin = req.session?.isAdmin || req.user?.isAdmin || false;
    // Job Vacancy can only be edited by Employer with matching email
    const isOwner = currentUser && 
                    jobVacancy.email && 
                    currentUser.email === jobVacancy.email &&
                    currentUser.role === 'Employer';
    
    if (!isAdmin && !isOwner) {
      req.flash?.('error', 'You do not have permission to edit this job vacancy');
      return res.redirect(`/rdf-resource/Job_Vacancies/${id}`);
    }

    const [studentTypes, teaching] = await Promise.all([
      JobVacancy.distinct('studentType'),
      JobVacancy.distinct('teachingArea'),
    ]);

    res.render('jobVacancy/edit', {
      jobVacancy,
      countries: STANDARD_COUNTRIES,
      studentTypes: (studentTypes || []).filter(Boolean).sort(),
      teachingAreas: (teaching || []).filter(Boolean).sort(),
      errors: {}
    });
  }
);

// Update (PUT)
router.put(
  '/job-vacancies/:id',
  requireLogin,
  async (req, res) => {
    try {
      const { id } = req.params;
      // Try to find in both collections (job_vacancies and Job_Vacancies_RDF)
      let jobVacancy = await JobVacancy.findById(id);
      let isRdfOnly = false;
      
      // If not found in job_vacancies, try RDF collection
      if (!jobVacancy) {
        const db = mongoose.connection.db;
        const rdfDoc = await db.collection('Job_Vacancies_RDF').findOne({ 
          _id: new mongoose.Types.ObjectId(id) 
        });
        if (rdfDoc) {
          jobVacancy = rdfDoc;
          isRdfOnly = true;
        }
      }
      
      if (!jobVacancy) return res.status(404).send('Not found');

      // Check if user is owner or admin
      const currentUser = req.user;
      const isAdmin = req.session?.isAdmin || req.user?.isAdmin || false;
      // Job Vacancy can only be edited by Employer with matching email
      const isOwner = currentUser && 
                      jobVacancy.email && 
                      currentUser.email === jobVacancy.email &&
                      currentUser.role === 'Employer';
      
      if (!isAdmin && !isOwner) {
        req.flash?.('error', 'You do not have permission to edit this job vacancy');
        return res.redirect(`/rdf-resource/Job_Vacancies/${id}`);
      }

      // Validate and update
      const payload = normalizePayload(req.body);
      const errors = validatePayload(payload);
      let taOut = toStringArray(payload.teachingArea);
      taOut = mergeExtraAreas(taOut, req.body.extraTeachingArea);

      if (Object.keys(errors).length) {
        const [studentTypes, teaching] = await Promise.all([
          JobVacancy.distinct('studentType'),
          JobVacancy.distinct('teachingArea'),
        ]);

        return res.status(422).render('jobVacancy/edit', {
          jobVacancy: { 
            ...(jobVacancy.toObject ? jobVacancy.toObject() : jobVacancy), 
            ...payload 
          },
          countries: STANDARD_COUNTRIES,
          studentTypes: (studentTypes || []).filter(Boolean).sort(),
          teachingAreas: (teaching || []).filter(Boolean).sort(),
          errors
        });
      }

      const title = (payload.title || '').trim();
      const _label = (req.body._labelOverride || title).trim();
      const _description = (req.body._descriptionOverride || payload.description || '').trim();

      const updateData = {
        ...payload,
        teachingArea: taOut,
        title,
        _label,
        _description,
        datePosted: payload.datePosted || jobVacancy.datePosted
      };

      // Update document based on collection type
      if (isRdfOnly) {
        // Update RDF collection directly
        const db = mongoose.connection.db;
        await db.collection('Job_Vacancies_RDF').updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { $set: updateData }
        );
      } else {
        // Update Mongoose model
        Object.assign(jobVacancy, updateData);
        await jobVacancy.save();
        await mirrorToRDF(jobVacancy);
      }

      req.flash?.('success', 'Job vacancy updated successfully.');
      return res.redirect(`/rdf-resource/Job_Vacancies/${id}`);

    } catch (err) {
      console.error('[UPDATE] job-vacancy error:', err);
      return res.status(500).render('error', { 
        message: 'Failed to update job vacancy', 
        error: err 
      });
    }
  }
);

// Delete (DELETE)
router.delete(
  '/job-vacancies/:id',
  requireLogin,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Try to find in both collections
      let jobVacancy = await JobVacancy.findById(id);
      let isRdfOnly = false;
      
      // If not found in job_vacancies, try RDF collection
      if (!jobVacancy) {
        const db = mongoose.connection.db;
        const rdfDoc = await db.collection('Job_Vacancies_RDF').findOne({ 
          _id: new mongoose.Types.ObjectId(id) 
        });
        if (rdfDoc) {
          jobVacancy = rdfDoc;
          isRdfOnly = true;
        }
      }
      
      if (!jobVacancy) {
        return res.status(404).send('Job vacancy not found');
      }

      // Check permission: Admin or Owner
      const currentUser = req.user;
      const isAdmin = req.session?.isAdmin || req.user?.isAdmin || false;
      const isOwner = currentUser && 
                      jobVacancy.email && 
                      currentUser.email === jobVacancy.email &&
                      currentUser.role === 'Employer';
      
      if (!isAdmin && !isOwner) {
        req.flash?.('error', 'You do not have permission to delete this job vacancy');
        return res.status(403).send('❌ Unauthorized: You do not have permission to delete this job vacancy');
      }

      // Delete from both collections
      if (isRdfOnly) {
        // Delete from RDF collection only
        const db = mongoose.connection.db;
        await db.collection('Job_Vacancies_RDF').deleteOne({ 
          _id: new mongoose.Types.ObjectId(id) 
        });
      } else {
        // Delete from Mongoose model
        await JobVacancy.deleteOne({ _id: id });
        
        // Also delete from RDF collection if exists
        try {
          const db = mongoose.connection.db;
          await db.collection('Job_Vacancies_RDF').deleteOne({ 
            _id: new mongoose.Types.ObjectId(id) 
          });
        } catch (rdfErr) {
          console.warn('[DELETE] Failed to delete from RDF collection:', rdfErr.message);
        }
      }

      req.flash?.('success', 'Job vacancy deleted successfully.');
      return res.redirect('/facet/Job_Vacancies');

    } catch (err) {
      console.error('[DELETE] job-vacancy error:', err);
      return res.status(500).send('❌ Failed to delete job vacancy');
    }
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
        { teachingArea: { $regex: `^${teachingArea}$`, $options: 'i' } }
      ];
    }

    const [jobs, countries, studentTypes, teachingAreas] = await Promise.all([
      JobVacancy.find(q).sort({ datePosted: -1, createdAt: -1 }).limit(200).lean(),
      JobVacancy.distinct('country'),
      JobVacancy.distinct('studentType'),
      JobVacancy.distinct('teachingArea'),
    ]);

    const sortClean = (arr) => (arr || []).filter(Boolean).sort();

    return res.render('jobVacancy/index', {
      jobs,
      filters: {
        country: country || '',
        studentType: studentType || '',
        teachingArea: teachingArea || ''
      },
      countries: sortClean(countries),
      studentTypes: sortClean(studentTypes),
      teachingAreas: sortClean(teachingAreas),
    });
  } catch (err) {
    console.error('GET /job-vacancies error:', err);
    return next(err);
  }
});

module.exports = router;
