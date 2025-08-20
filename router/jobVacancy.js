const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const JobVacancy = require('../model/jobVacancy');

// 프리셋(서버에서 안 넘길 때 폼이 자체 기본값을 쓰지만, 넘겨두면 더 확실)
const defaultCountries    = ['Korea','Japan','China','Malaysia','Thailand'];
const defaultStudentTypes = ['Adults','Elementary','High School','Kindergarten','Middle'];
const defaultTeaching     = ['Art','Biology','English','ESL','Social Studies','Spanish'];

// method-override (app.js에서 이미 했다면 생략)
router.use(methodOverride('_method'));

/** 공통: 요청 바디를 표준 필드로 정규화 */
function normalizePayload(body) {
  // Title / Description: 두 가지 네이밍 모두 지원
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

  // 날짜 문자열 정규화(YYYY-MM-DD만 들어오면 그대로)
  const datePosted = body.datePosted ? new Date(body.datePosted) : null;

  // 커스텀 입력 우선(폼에서 handleCustomFields로 hidden을 붙이지만, 방어적으로 한 번 더)
  const country = body.country ?? '';
  const studentType = body.studentType ?? '';
  const teachingArea = body.teachingArea ?? '';

  return {
    title,
    description,
    country,
    studentType,
    teachingArea,
    duration: body.duration ?? '',
    pay: body.pay ?? '',
    housing: body.housing ?? '',
    email: body.email ?? '',
    companyName: body.companyName ?? '',
    jobLocation: body.jobLocation ?? '',
    cellphoneNumber: body.cellphoneNumber ?? '',
    homepage: body.homepage ?? '',
    datePosted,
    // yes/no 라디오 값 그대로 저장(스키마가 boolean이면 여기서 boolean 변환)
    resumeAccess: body.resumeAccess === 'yes' ? 'yes' : 'no'
  };
}

/** 간단한 서버측 검증(이모지/한글 금지 규칙이 있다면 반영) */
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
  if (!p.country) errors.country = 'Host Country is required.';
  if (!p.studentType) errors.studentType = 'Student Type is required.';
  if (!p.teachingArea) errors.teachingArea = 'Teaching Area is required.';
  return errors;
}

/* ------------------ NEW ------------------ */
router.get('/job-vacancies/new', (req, res) => {
  res.render('jobVacancies/new', {
    // new.pug에서는 내부 프리셋을 갖고 있지만, 서버에서 넘겨주면 그 값을 우선 사용
    countries: defaultCountries,
    studentTypes: defaultStudentTypes,
    teachingAreas: defaultTeaching,
    adPlans: req.adPlans || null,       // 있으면 표시(없다면 템플릿에서 기본 플랜)
    tokensLeft: req.tokensLeft ?? null, // 있으면 안내
  });
});

/* ------------------ CREATE ------------------ */
router.post('/job-vacancies', async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      // 폼은 new.pug(부트스트랩) 버전이므로, 값/에러를 넘기려면 변수명을 맞춰야 합니다.
      return res.status(422).render('jobVacancies/new', {
        countries: defaultCountries,
        studentTypes: defaultStudentTypes,
        teachingAreas: defaultTeaching,
        adPlans: req.adPlans || null,
        tokensLeft: req.tokensLeft ?? null,
        // new.pug는 `values`/`errors`를 안 쓰고 직접 name 바인딩이라면 생략 가능
        // 필요시 new.pug에 values/errors 바인딩 추가 후 아래 객체를 전달하세요.
        values: req.body,
        errors,
      });
    }

    const doc = new JobVacancy(payload);
    await doc.save();
    req.flash?.('success', 'Job vacancy created.');
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[CREATE] job-vacancy error:', err);
    res.status(500).render('error', { message: 'Failed to create job vacancy', error: err });
  }
});

/* ------------------ EDIT ------------------ */
router.get('/job-vacancies/:id/edit', async (req, res) => {
  const { id } = req.params;
  const jobVacancy = await JobVacancy.findById(id);
  if (!jobVacancy) return res.status(404).send('Not found');
  res.render('jobVacancies/edit', {
    jobVacancy,
    countries: defaultCountries,
    studentTypes: defaultStudentTypes,
    teachingAreas: defaultTeaching
  });
});

/* ------------------ UPDATE ------------------ */
router.put('/job-vacancies/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      const jobVacancy = await JobVacancy.findById(id);
      return res.status(422).render('jobVacancies/edit', {
        jobVacancy: { ...jobVacancy.toObject(), ...payload }, // 사용자가 입력한 값 반영
        countries: defaultCountries,
        studentTypes: defaultStudentTypes,
        teachingAreas: defaultTeaching,
        errors
      });
    }

    await JobVacancy.findByIdAndUpdate(id, payload, { new: true });
    req.flash?.('success', 'Job vacancy updated.');
    res.redirect('/job-vacancies');
  } catch (err) {
    console.error('[UPDATE] job-vacancy error:', err);
    res.status(500).render('error', { message: 'Failed to update job vacancy', error: err });
  }
});

module.exports = router;
