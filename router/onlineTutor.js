const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');

// ✅ 목록 (로그인 필수)
router.get('/', requireLogin, async (req, res) => {
  try {
    const tutors = await OnlineTutor.find().sort({ createdAt: -1 });
    res.render('onlineTutor/index', { tutors });
  } catch (err) {
    console.error('❌ Error fetching tutors:', err.message);
    res.status(500).send('❌ Error fetching tutors');
  }
});

// ✅ 새 Tutor 폼
router.get('/new', requireLogin, async (req, res) => {
  try {
    res.render('onlineTutor/new');
  } catch (err) {
    console.error('❌ Error loading form:', err.message);
    res.status(500).send('❌ Error loading form');
  }
});

// ✅ 새 Tutor 저장
router.post('/', requireLogin, async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      subject: sanitizeHtml(req.body.subject || ''),
      description: sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} }),
      email: req.body.email
    };
    const newTutor = new OnlineTutor(data);
    await newTutor.save();
    res.redirect('/facet/Online_Tutors');
  } catch (err) {
    console.error('❌ Error saving tutor:', err.message);
    res.status(500).send('❌ Error saving tutor');
  }
});

// ✅ 수정 폼
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

// ✅ 수정 처리
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('❌ Tutor not found');
    tutor.name = req.body.name;
    tutor.subject = sanitizeHtml(req.body.subject || '');
    tutor.description = sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} });
    tutor.email = req.body.email;
    await tutor.save();
    res.redirect('/facet/Online_Tutors');
  } catch (err) {
    console.error('❌ Error updating tutor:', err.message);
    res.status(500).send('❌ Error updating tutor');
  }
});

// ✅ 삭제
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    await OnlineTutor.findByIdAndDelete(req.params.id);
    res.redirect('/facet/Online_Tutors');
  } catch (err) {
    console.error('❌ Error deleting tutor:', err.message);
    res.status(500).send('❌ Error deleting tutor');
  }
});

module.exports = router;
