const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');
const { requireLogin } = require('../middleware/auth');

// ✅ 선택 항목 정의 (중앙 집중식)
const genders = ['Male', 'Female', 'Other'];
const expertises = ['Grammar', 'Conversation', 'ExamPrep', 'BusinessEnglish', 'TOEFL', 'IELTS'];
const tutoringExperiences = ['Beginner', 'Intermediate', 'Advanced', 'Less than 1 year', '5+ years'];
const communicationMethods = ['Zoom', 'Skype', 'Email', 'GoogleMeet', 'Phone'];
const languages = ['English', 'Korean', 'Spanish', 'French', 'Chinese'];

console.log('✅ onlineTutor router loaded');

// ✅ 목록
router.get('/', async (req, res) => {
  try {
    const tutors = await OnlineTutor.find().sort({ createdAt: -1 });
    res.render('onlineTutor/index', { tutors });
  } catch (err) {
    console.error('Error loading tutors:', err);
    res.status(500).send('Server Error');
  }
});

// ✅ 등록 폼
router.get('/new', requireLogin, (req, res) => {
  res.render('onlineTutor/new', {
    genders,
    expertises,
    tutoringExperiences,
    communicationMethods,
    languages
  });
});

// ✅ 신규 등록 처리
router.post('/', requireLogin, async (req, res) => {
  try {
    const data = { ...req.body };

    // ✅ 쉼표로 구분된 문자열을 배열로 변환
    if (data.languagesSpoken) {
      data.languagesSpoken = data.languagesSpoken.split(',').map(s => s.trim());
    }

    const tutor = new OnlineTutor(data);
    await tutor.save();
    res.redirect(`/online-tutor/${tutor._id}`);
  } catch (err) {
    console.error('Error saving tutor:', err);
    res.status(400).send('Error saving tutor');
  }
});

// ✅ 상세 보기
router.get('/:id', async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('Tutor not found');
    res.render('onlineTutor/show', { tutor });
  } catch (err) {
    console.error('Error fetching tutor:', err);
    res.status(500).send('Server Error');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const tutor = await OnlineTutor.findById(req.params.id);
    if (!tutor) return res.status(404).send('Tutor not found');
    res.render('onlineTutor/edit', {
      tutor,
      genders,
      expertises,
      tutoringExperiences,
      communicationMethods,
      languages
    });
  } catch (err) {
    console.error('Error loading edit form:', err);
    res.status(500).send('Server Error');
  }
});

// ✅ 수정 처리
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const data = { ...req.body };

    if (data.languagesSpoken) {
      data.languagesSpoken = data.languagesSpoken.split(',').map(s => s.trim());
    }

    await OnlineTutor.findByIdAndUpdate(req.params.id, data, { runValidators: true });
    res.redirect(`/online-tutor/${req.params.id}`);
  } catch (err) {
    console.error('Error updating tutor:', err);
    res.status(400).send('Error updating tutor');
  }
});

// ✅ 삭제 (선택적 구현)
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    await OnlineTutor.findByIdAndDelete(req.params.id);
    res.redirect('/online-tutor');
  } catch (err) {
    console.error('Error deleting tutor:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
