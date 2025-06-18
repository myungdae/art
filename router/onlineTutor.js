const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');
const sanitizeHtml = require('sanitize-html');

// ✅ 전체 리스트 조회
router.get('/', async (req, res) => {
  try {
    const tutors = await OnlineTutor.find().sort({ createdAt: -1 });
    res.render('onlineTutor/index', { tutors });  // ✅ 뷰: views/onlineTutor/index.pug
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ✅ 신규 등록 폼
router.get('/new', (req, res) => {
  res.render('onlineTutor/new');
});

// ✅ 신규 등록 처리
router.post('/', async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      jobTitle: req.body.jobTitle,
      description: sanitizeHtml(req.body.description),
      gender: req.body.gender,
      expertise: Array.isArray(req.body.expertise) ? req.body.expertise : [req.body.expertise],
      tutoringExperience: req.body.tutoringExperience,
      communicationMethods: Array.isArray(req.body.communicationMethods) ? req.body.communicationMethods : [req.body.communicationMethods],
      email: req.body.email,
      skypeId: req.body.skypeId,
      zoomId: req.body.zoomId,
      hourlyRate: req.body.hourlyRate,
      availableFrom: req.body.availableFrom,
      availableTime: req.body.availableTime,
      languagesSpoken: req.body.languagesSpoken?.split(',').map(s => s.trim()),
      '@type': 'Online_Tutor'
    };

    const newTutor = new OnlineTutor(data);
    await newTutor.save();
    res.redirect('/online-tutor');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving tutor');
  }
});

// ✅ 상세 보기
router.get('/:id', async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('Tutor not found');
    res.render('onlineTutor/show', { tutor });
  } catch (err) {
    console.error(err);
    res.status(500).send('Tutor not found');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('Tutor not found');
    res.render('onlineTutor/edit', { tutor });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading edit form');
  }
});

// ✅ 수정 처리
router.put('/:id', async (req, res) => {
  try {
    const updatedData = {
      name: req.body.name,
      jobTitle: req.body.jobTitle,
      description: sanitizeHtml(req.body.description),
      gender: req.body.gender,
      expertise: Array.isArray(req.body.expertise) ? req.body.expertise : [req.body.expertise],
      tutoringExperience: req.body.tutoringExperience,
      communicationMethods: Array.isArray(req.body.communicationMethods) ? req.body.communicationMethods : [req.body.communicationMethods],
      email: req.body.email,
      skypeId: req.body.skypeId,
      zoomId: req.body.zoomId,
      hourlyRate: req.body.hourlyRate,
      availableFrom: req.body.availableFrom,
      availableTime: req.body.availableTime,
      languagesSpoken: req.body.languagesSpoken?.split(',').map(s => s.trim())
    };

    await OnlineTutor.findByIdAndUpdate(req.params.id, updatedData);
    res.redirect(`/online-tutor/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating tutor');
  }
});

// ✅ 삭제 처리
router.delete('/:id', async (req, res) => {
  try {
    await OnlineTutor.findByIdAndDelete(req.params.id);
    res.redirect('/online-tutor');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting tutor');
  }
});

module.exports = router;
