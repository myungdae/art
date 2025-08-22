// router/onlineTutor.js
'use strict';

const express = require('express');
const router = express.Router();
const methodOverride = require('method-override');
const mongoose = require('mongoose');

const OnlineTutor = require('../model/onlineTutor');
const validateObjectId = require('../middleware/validateObjectId');
const { requireLogin, requireRole } = require('../middleware/auth');

router.use(methodOverride('_method'));
router.param('id', validateObjectId('id'));

/* -------------------- Presets -------------------- */
const defaultExpertise = [
  'Conversation', 'Grammar', 'BusinessEnglish', 'ExamPrep',
  'TOEFL', 'IELTS', 'Kids', 'Pronunciation'
];
const defaultExperiences = ['Beginner', 'Intermediate', 'Advanced', '5+ years', '10+ years'];
const defaultGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];

/* -------------------- Helpers -------------------- */
const toStringArray = (v) => {
  if (Array.isArray(v)) {
    return v.flatMap(x => String(x).split(','))
      .map(s => s.trim()).filter(Boolean);
  }
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
};
const mergeExtraCsv = (arr, csv) => {
  const extra = String(csv || '').split(',').map(s => s.trim()).filter(Boolean);
  return Array.from(new Set([...(arr || []), ...extra]));
};

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

  // 시맨틱/일반 키 흡수
  let expertise =
    body.Expertise ??
    body.expertise ??
    body['esl:expertise[@value]'] ??
    [];

  expertise = toStringArray(expertise);
  expertise = mergeExtraCsv(expertise, body.extraExpertise);

  const tutoringExperience =
    body.Tutoring_Experience ??
    body.tutoringExperience ??
    body['esl:tutoringExperience[@value]'] ??
    '';

  const gender =
    body.Gender ??
    body.gender ??
    body['schema:gender[@value]'] ??
    '';

  // email: trim + lowercase
  const email = String((body.email || '').trim().toLowerCase());

  return {
    title,
    description,
    Expertise: expertise,                 // array<string>
    Tutoring_Experience: String(tutoringExperience || ''),
    Gender: String(gender || ''),
    email,                                // required (서버 검증)
  };
}

function validatePayload(p) {
  const errors = {};
  if (!p.Expertise || !p.Expertise.length) errors.Expertise = 'Select at least one expertise.';
  if (!p.Tutoring_Experience) errors.Tutoring_Experience = 'Tutoring experience is required.';
  if (!p.Gender) errors.Gender = 'Gender is required.';
  if (!p.email) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.email = 'Please enter a valid email.';
  return errors;
}

/* -------------------- RDF Mirror -------------------- */
async function mirrorToRDF(tutorDoc) {
  const db = mongoose.connection.db;

  const doc = {
    _id: tutorDoc._id,
    '@id': tutorDoc['@id'] || `onlinetutor:${tutorDoc._id}`,
    _class: 'Online_Tutors',
    _label: tutorDoc._label || tutorDoc.title || '',
    _description: tutorDoc._description || tutorDoc.description || '',
    Expertise: Array.isArray(tutorDoc.Expertise) ? tutorDoc.Expertise : (tutorDoc.Expertise ? [tutorDoc.Expertise] : []),
    Tutoring_Experience: tutorDoc.Tutoring_Experience || '',
    Gender: tutorDoc.Gender || '',
    datePosted: tutorDoc.datePosted || tutorDoc.createdAt || new Date(),
    updatedAt: new Date()
  };

  await db.collection('Online_Tutors_RDF')
          .updateOne({ _id: tutorDoc._id }, { $set: doc }, { upsert: true });

  // 호환 컬렉션(있으면) 반영
  try {
    await db.collection('Online_Tutors')
            .updateOne({ _id: tutorDoc._id }, { $set: doc }, { upsert: true });
  } catch (_) {}
}

/* -------------------- New -------------------- */
router.get('/online-tutors/new',
  requireLogin,
  requireRole(['Online_Tutor', 'Tutor']),     // ← 별칭 모두 허용
  async (req, res) => {
    res.render('onlineTutor/new', {
      expertiseList: defaultExpertise,
      expList: defaultExperiences,
      genderList: defaultGenders,
      values: {},
      errors: {}
    });
  }
);

/* -------------------- Create -------------------- */
router.post('/online-tutors',
  requireLogin,
  requireRole(['Online_Tutor', 'Tutor']),
  async (req, res) => {
    try {
      const payload = normalizePayload(req.body);
      const errors = validatePayload(payload);

      if (Object.keys(errors).length) {
        return res.status(422).render('onlineTutor/new', {
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          values: { ...payload, extraExpertise: req.body.extraExpertise || '' },
          errors
        });
      }

      const title  = (payload.title || '').trim();
      const _label = (req.body._labelOverride || title).trim();
      const _description = (req.body._descriptionOverride || payload.description || '').trim();

      const userId = String(req.user?._id || req.session?.user?._id || '');

      const doc = new OnlineTutor({
        ...payload,
        user: userId,
        title,
        _label,
        _description,
        datePosted: new Date()
      });

      await doc.save();
      await mirrorToRDF(doc);

      req.flash?.('success', 'Tutor profile created.');
      return res.redirect('/facet/Online_Tutors');
    } catch (err) {
      console.error('[ONLINE-TUTOR CREATE] error:', err);

      // DB 스키마 검증 실패는 같은 폼으로 되돌려 UX 개선
      if (err?.name === 'ValidationError') {
        const payload = normalizePayload(req.body);
        const valErrs = {};
        for (const k in err.errors) {
          valErrs[k] = err.errors[k].message || `Invalid ${k}`;
        }
        return res.status(422).render('onlineTutor/new', {
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          values: { ...payload, extraExpertise: req.body.extraExpertise || '' },
          errors: valErrs
        });
      }

      // 그 외 예외만 에러 페이지
      return res.status(500).render('error', { message: 'Failed to create tutor profile', error: err });
    }
  }
);

/* -------------------- Edit -------------------- */
router.get('/online-tutors/:id/edit',
  requireLogin,
  requireRole(['Online_Tutor', 'Tutor']),
  async (req, res) => {
    const { id } = req.params;
    const onlineTutor = await OnlineTutor.findById(id);
    if (!onlineTutor) return res.status(404).send('Not found');

    // 본인 소유만 수정 허용
    const userId = String(req.user?._id || req.session?.user?._id || '');
    if (String(onlineTutor.user || '') !== userId) {
      return res.status(403).send('Forbidden: not owner');
    }

    res.render('onlineTutor/edit', {
      onlineTutor,
      expertiseList: defaultExpertise,
      expList: defaultExperiences,
      genderList: defaultGenders,
      errors: {}
    });
  }
);

/* -------------------- Delete -------------------- */
router.delete('/online-tutors/:id',
  requireLogin,
  requireRole(['Online_Tutor','Tutor','Admin']),
  async (req, res) => {
    const { id } = req.params;
    const doc = await OnlineTutor.findById(id);
    if (!doc) return res.status(404).send('Not found');

    // 본인 소유 or Admin
    const userId = String(req.user?._id || req.session?.user?._id || '');
    const isOwner = String(doc.user || '') === userId;
    const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).send('Forbidden: not owner');

    await OnlineTutor.findByIdAndDelete(id);
    try { await mongoose.connection.db.collection('Online_Tutors_RDF').deleteOne({ _id: doc._id }); } catch (_) {}

    return res.redirect('/facet/Online_Tutors');
  }
);

/* -------------------- Update -------------------- */
router.put('/online-tutors/:id',
  requireLogin,
  requireRole(['Online_Tutor', 'Tutor']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const payload = normalizePayload(req.body);
      const errors = validatePayload(payload);

      if (Object.keys(errors).length) {
        const onlineTutor = await OnlineTutor.findById(id);
        return res.status(422).render('onlineTutor/edit', {
          onlineTutor: onlineTutor ? { ...onlineTutor.toObject(), ...payload } : payload,
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          errors
        });
      }

      const title  = (payload.title || '').trim();
      const _label = (req.body._labelOverride || title).trim();
      const _description = (req.body._descriptionOverride || payload.description || '').trim();

      const updated = await OnlineTutor.findByIdAndUpdate(
        id,
        {
          ...payload,
          title,
          _label,
          _description,
          datePosted: new Date()
        },
        { new: true, runValidators: true }
      );

      if (updated) await mirrorToRDF(updated);

      req.flash?.('success', 'Tutor profile updated.');
      return res.redirect('/facet/Online_Tutors');
    } catch (err) {
      console.error('[ONLINE-TUTOR UPDATE] error:', err);

      // 검증 실패는 동일 폼으로 422
      if (err?.name === 'ValidationError') {
        const payload = normalizePayload(req.body);
        const valErrs = {};
        for (const k in err.errors) {
          valErrs[k] = err.errors[k].message || `Invalid ${k}`;
        }
        const onlineTutor = await OnlineTutor.findById(id);
        return res.status(422).render('onlineTutor/edit', {
          onlineTutor: onlineTutor ? { ...onlineTutor.toObject(), ...payload } : payload,
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          errors: valErrs
        });
      }

      return res.status(500).render('error', { message: 'Failed to update tutor profile', error: err });
    }
  }
);

module.exports = router;
