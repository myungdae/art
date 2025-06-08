const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');

// 목록
router.get('/', async (req, res) => {
  const tutors = await OnlineTutor.find();
  res.render('onlineTutor/list', { tutors });
});

// 생성 폼
router.get('/new', (req, res) => {
  res.render('onlineTutor/create');
});

// 생성 처리
router.post('/new', async (req, res) => {
  req.body['@type'] = 'Online_Tutor';
  await OnlineTutor.create(req.body);
  res.redirect('/online-tutor');
});

// 수정 폼
router.get('/edit/:id', async (req, res) => {
  const tutor = await OnlineTutor.findById(req.params.id);
  res.render('onlineTutor/edit', { tutor });
});

// 수정 처리
router.post('/edit/:id', async (req, res) => {
  await OnlineTutor.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/online-tutor');
});

// 삭제
router.get('/delete/:id', async (req, res) => {
  await OnlineTutor.findByIdAndDelete(req.params.id);
  res.redirect('/online-tutor');
});

module.exports = router;
