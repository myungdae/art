const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const FACET_COLL = 'esl';

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
    await client.db(DB_NAME).collection(FACET_COLL)
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
    res.render('onlineTutor/new');
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
  res.render('onlineTutor/edit', { tutor });
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
