// router/onlineTutor.js
const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const OnlineTutor = require('../model/onlineTutor');

router.use(methodOverride('_method'));

const validateObjectId = require('../middleware/validateObjectId');   // ✅ 추가

router.param('id', validateObjectId('id'));                           // ✅ 추가


/* 프리셋(뷰로 전달) */
const defaultExpertise = [
  'ESL', 'Conversation', 'Grammar', 'Business English', 'Kids English', 'Test Prep (TOEIC/IELTS)'
];
const defaultTutoringExp = ['0-1 year', '1-3 years', '3-5 years', '5+ years'];
const defaultGenders = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

/* 정규화 */
function normalizePayload(body) {
  const description =
    body['http://purl.org/dc/elements/1.1/description[@value]'] ??
    body._description ??
    body.description ??
    '';

  const expertise =
    body['esl:expertise[@value]'] ??
    body.Expertise ??
    body.expertise ??
    '';

  const tutoringExperience =
    body['esl:tutoringExperience[@value]'] ??
    body.Tutoring_Experience ??
    body.tutoring_experience ??
    body.tutoringExperience ??
    '';

  // 오탈자 Gendder도 수용
  const gender =
    body['esl:gender[@value]'] ??
    body.Gender ??
    body.gender ??
    body.Gendder ??
    '';

  const skypeId =
    body['Skype_ID'] ??
    body.skypeId ??
    body.skype_id ??
    '';

  return {
    fullName: body.fullName ?? body.name ?? '',
    email: body.email ?? '',
    description,
    expertise,
    tutoringExperience,
    gender,
    skypeId,
  };
}

function validatePayload(p) {
  const errors = {};
  if (!p.email) errors.email = 'Email is required.';
  // 필요 시 다른 필수값도 추가
  return errors;
}

/* NEW */
router.get('/online-tutors/new', (req, res) => {
  res.render('onlineTutor/new', {
    expertiseList: defaultExpertise,
    tutoringExpList: defaultTutoringExp,
    genderList: defaultGenders,
    values: {},
    errors: {}
  });
});

/* CREATE */
router.post('/online-tutors', async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      return res.status(422).render('onlineTutor/new', {
        expertiseList: defaultExpertise,
        tutoringExpList: defaultTutoringExp,
        genderList: defaultGenders,
        values: req.body,
        errors
      });
    }

    const doc = new OnlineTutor(payload);
    await doc.save();
    req.flash?.('success', 'Online Tutor profile created.');
    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('[OnlineTutor CREATE] error:', err);
    return res.status(500).render('error', { message: 'Failed to create online tutor', error: err });
  }
});

/* EDIT */
router.get('/online-tutors/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const onlineTutor = await OnlineTutor.findById(id);
    if (!onlineTutor) return res.status(404).send('Not found');

    res.render('onlineTutor/edit', {
      onlineTutor,
      expertiseList: defaultExpertise,
      tutoringExpList: defaultTutoringExp,
      genderList: defaultGenders,
      errors: {}
    });
  } catch (err) {
    console.error('[OnlineTutor EDIT] error:', err);
    return res.status(500).render('error', { message: 'Failed to open online tutor', error: err });
  }
});

/* UPDATE */
router.put('/online-tutors/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      const onlineTutor = await OnlineTutor.findById(id);
      return res.status(422).render('onlineTutor/edit', {
        onlineTutor: onlineTutor ? { ...onlineTutor.toObject(), ...payload } : payload,
        expertiseList: defaultExpertise,
        tutoringExpList: defaultTutoringExp,
        genderList: defaultGenders,
        errors
      });
    }

    await OnlineTutor.findByIdAndUpdate(id, payload, { new: true });
    req.flash?.('success', 'Online Tutor profile updated.');
    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('[OnlineTutor UPDATE] error:', err);
    return res.status(500).render('error', { message: 'Failed to update online tutor', error: err });
  }
});

module.exports = router;
