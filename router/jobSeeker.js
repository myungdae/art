// router/jobSeeker.js  (FULL DROP-IN)
const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const JobSeeker = require('../model/jobSeeker');

// query ?_method=PUT 지원 (app.js에서 이미 했다면 이 줄은 중복 가능)
router.use(methodOverride('_method'));

/* -------------------- Presets (서버에서 뷰로 전달) -------------------- */
const defaultNationalities = ['Korean','Japanese','Chinese','Malaysian','Thai','American','British'];
const defaultPrefWorkLocs  = ['Korea','Japan','China','Malaysia','Thailand','Remote'];
const defaultMajors        = ['English','ESL','Education','Art','Biology','Social Studies','Spanish'];
const defaultLanguages     = ['English','Korean','Japanese','Chinese','Spanish','French','German'];

/* -------------------- Utilities -------------------- */
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** 요청 바디 → 표준 필드로 정규화 (시맨틱/일반 키 모두 흡수) */
function normalizePayload(body) {
  // Title / Description (CKEditor HTML 허용)
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

  // 시맨틱 3종
  const nationality =
    body['http://schema.org/nationality[@value]'] ??
    body['schema:nationality[@value]'] ??
    body.Nationality ??
    body.nationality ??
    '';

  const preferredWorkLocation =
    body['esl:preferredWorkLocation[@value]'] ??
    body.Preferred_Work_Location ??
    body.preferred_work_location ??
    body.preferredWorkLocation ??
    '';

  const major =
    body['esl:major[@value]'] ??
    body.Major ??
    body.major ??
    '';

  // 언어: 콤마 구분 문자열 또는 체크박스 배열 모두 허용
  let languageSpoken =
    body['schema:knowsLanguage[@value]'] ??
    body.languageSpoken ??
    body.languages ??
    '';
  if (Array.isArray(languageSpoken)) {
    languageSpoken = languageSpoken
      .flatMap(v => String(v).split(','))
      .map(s => s.trim())
      .filter(Boolean);
  } else {
    languageSpoken = String(languageSpoken || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  return {
    // 기본 프로필
    fullName: body.fullName ?? body.name ?? '',
    email: body.email ?? '',

    // 제목/설명
    title,
    description, // CKEditor HTML 그대로 저장 (렌더 시 sanitize 권장)

    // 시맨틱 3종
    nationality,
    preferredWorkLocation,
    major,

    // 기타
    languageSpoken,                       // 스키마가 String이면 .join(', ')로 바꿔서 저장하세요.
    dateAvailable: parseDate(body.dateAvailable),
  };
}

/** 최소 서버 검증 */
function validatePayload(p) {
  const errors = {};
  if (!p.email) errors.email = 'Email is required.';
  // 필요시 title/nationality 등 추가 검증 가능
  return errors;
}

/* -------------------- NEW -------------------- */
// GET /job-seekers/new
router.get('/job-seekers/new', (req, res) => {
  res.render('jobSeeker/new', {
    nationalities: defaultNationalities,
    preferredWorkLocations: defaultPrefWorkLocs,
    majors: defaultMajors,
    languages: defaultLanguages,
    values: {},
    errors: {}
  });
});

/* -------------------- CREATE -------------------- */
// POST /job-seekers
router.post('/job-seekers', async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      return res.status(422).render('jobSeeker/new', {
        nationalities: defaultNationalities,
        preferredWorkLocations: defaultPrefWorkLocs,
        majors: defaultMajors,
        languages: defaultLanguages,
        values: req.body,
        errors
      });
    }

    // 🔧 만약 model이 languageSpoken:String 이라면:
    // payload.languageSpoken = Array.isArray(payload.languageSpoken) ? payload.languageSpoken.join(', ') : String(payload.languageSpoken || '');

    const doc = new JobSeeker(payload);
    await doc.save();

    req.flash?.('success', 'JobSeeker profile created.');
    return res.redirect('/admin/dashboard'); // 필요시 목록 페이지로 변경
  } catch (err) {
    console.error('[JobSeeker CREATE] error:', err);
    return res.status(500).render('error', { message: 'Failed to create job seeker', error: err });
  }
});

/* -------------------- EDIT -------------------- */
// GET /job-seekers/:id/edit
router.get('/job-seekers/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const jobSeeker = await JobSeeker.findById(id);
    if (!jobSeeker) return res.status(404).send('Not found');

    res.render('jobSeeker/edit', {
      jobSeeker,
      nationalities: defaultNationalities,
      preferredWorkLocations: defaultPrefWorkLocs,
      majors: defaultMajors,
      languages: defaultLanguages,
      errors: {}
    });
  } catch (err) {
    console.error('[JobSeeker EDIT] error:', err);
    return res.status(500).render('error', { message: 'Failed to open job seeker', error: err });
  }
});

/* -------------------- UPDATE -------------------- */
// PUT /job-seekers/:id
router.put('/job-seekers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      const jobSeeker = await JobSeeker.findById(id);
      return res.status(422).render('jobSeeker/edit', {
        jobSeeker: jobSeeker ? { ...jobSeeker.toObject(), ...payload } : payload,
        nationalities: defaultNationalities,
        preferredWorkLocations: defaultPrefWorkLocs,
        majors: defaultMajors,
        languages: defaultLanguages,
        errors
      });
    }

    // 🔧 model이 languageSpoken:String 이라면 동일하게 join 처리
    // payload.languageSpoken = Array.isArray(payload.languageSpoken) ? payload.languageSpoken.join(', ') : String(payload.languageSpoken || '');

    await JobSeeker.findByIdAndUpdate(id, payload, { new: true });
    req.flash?.('success', 'JobSeeker profile updated.');
    return res.redirect('/admin/dashboard'); // 필요시 목록 페이지로 변경
  } catch (err) {
    console.error('[JobSeeker UPDATE] error:', err);
    return res.status(500).render('error', { message: 'Failed to update job seeker', error: err });
  }
});

module.exports = router;
