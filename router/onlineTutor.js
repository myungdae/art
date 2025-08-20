// router/onlineTutor.js
const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const FACET_COLL = 'esl';

// ✅ 30/90/365 허용값 (config에서 관리)
const { profileDurations } = require('../config/plans');

/* ─────────────────────────────────────────────────────────────
   planDays 정규화: 폼에서 넘어온 값이 30/90/365 중 하나만 통과
   없거나 이상하면 기본값(profileDurations[0] → 대개 30)
   ───────────────────────────────────────────────────────────── */
function getPlanDaysFromBody(body) {
  const v = Number(body?.planDays);
  if (Number.isFinite(v) && profileDurations.includes(v)) return v;
  return profileDurations?.[0] ?? 30;
}

// ── facet(esl) 동기화 유틸 ──────────────────────────────────────────────
async function upsertFacetFromTutor(tutor) {
  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  try {
    const col = client.db(DB_NAME).collection(FACET_COLL);
    const filter = { source: 'online_tutors', sourceId: String(tutor._id) };
    const doc = {
      '@id': `esl:online_tutor:${tutor._id}`,          // ✅ 고유 @id
      '@type': 'Online_Tutors',
      source: 'online_tutors',
      sourceId: String(tutor._id),

      label: tutor.name || 'Untitled',
      title: tutor.name ? (tutor.subject ? `${tutor.name} · ${tutor.subject}` : tutor.name) : 'Untitled',
      description: tutor.description || '',
      teachingArea: tutor.subject || '',
      hostCountry: '',
      studentType: undefined,
      email: tutor.email || '',

      updatedAt: new Date()
    };
    await col.updateOne(filter, { $set: doc }, { upsert: true });
    console.log('[facet] upsert online_tutor → esl:', tutor._id);
  } finally {
    await client.close();
  }
}

async function removeFacetForTutor(id) {
  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  try {
    await client
      .db(DB_NAME)
      .collection(FACET_COLL)
      .deleteOne({ source: 'online_tutors', sourceId: String(id) });
    console.log('[facet] delete online_tutor in esl:', id);
  } finally {
    await client.close();
  }
}
// ───────────────────────────────────────────────────────────────────────

// 내부 목록(로그인)
router.get('/', requireLogin, async (req, res) => {
  try {
    const tutors = await OnlineTutor.find().sort({ createdAt: -1 });
    res.render('onlineTutor/index', { tutors });
  } catch (err) {
    console.error('❌ Error fetching tutors:', err.message);
    res.status(500).send('❌ Error fetching tutors');
  }
});

// 새 튜터 폼
router.get('/new', requireLogin, async (req, res) => {
  try {
    // ⬇️ 뷰에서 30/90/365를 그릴 수 있게 옵션 전달(선택사항)
    res.render('onlineTutor/new', { planOptions: profileDurations });
  } catch (err) {
    console.error('❌ Error loading form:', err.message);
    res.status(500).send('❌ Error loading form');
  }
});

// 생성
router.post('/', requireLogin, async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      subject: sanitizeHtml(req.body.subject || ''),
      description: sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} }),
      email: req.body.email
    };

    // ✅ 만료일/플랜 박기
    const days = getPlanDaysFromBody(req.body);
    const now  = new Date();
    data.createdAt = data.createdAt || now;
    data.expiresAt = new Date(now.getTime() + days * 86400000); // days → ms
    data.planDays  = days; // (선택 저장)

    const newTutor = await new OnlineTutor(data).save();
    await upsertFacetFromTutor(newTutor);               // ✅ facet 반영
    res.redirect('/facet/Online_Tutors');
  } catch (err) {
    console.error('❌ Error saving tutor:', err.message);
    res.status(500).send('❌ Error saving tutor');
  }
});

// 수정 폼
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('❌ Tutor not found');
    res.render('onlineTutor/edit', { tutor, planOptions: profileDurations });
  } catch (err) {
    console.error('❌ Error loading edit form:', err.message);
    res.status(500).send('❌ Error loading edit form');
  }
});

// 수정
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('❌ Tutor not found');

    tutor.name = req.body.name;
    tutor.subject = sanitizeHtml(req.body.subject || '');
    tutor.description = sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} });
    tutor.email = req.body.email;

    // ✅ planDays가 넘어온 경우에만 만료일 갱신
    if (typeof req.body.planDays !== 'undefined') {
      const days = getPlanDaysFromBody(req.body);
      const now  = new Date();
      tutor.expiresAt = new Date(now.getTime() + days * 86400000);
      tutor.planDays  = days;
    }

    await tutor.save();
    await upsertFacetFromTutor(tutor);                  // ✅ facet 반영
    res.redirect('/facet/Online_Tutors');
  } catch (err) {
    console.error('❌ Error updating tutor:', err.message);
    res.status(500).send('❌ Error updating tutor');
  }
});

// 삭제
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    await OnlineTutor.findByIdAndDelete(req.params.id);
    await removeFacetForTutor(req.params.id);           // ✅ facet 삭제
    res.redirect('/facet/Online_Tutors');
  } catch (err) {
    console.error('❌ Error deleting tutor:', err.message);
    res.status(500).send('❌ Error deleting tutor');
  }
});

module.exports = router;
