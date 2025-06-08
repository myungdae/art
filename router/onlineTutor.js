const express = require('express');
const router = express.Router();
const OnlineTutor = require('../model/onlineTutor');

// 목록
router.get('/', async (req, res) => {
  const tutors = await OnlineTutor.find();
  res.render('onlineTutors/list', { tutors });
});

// 생성 폼
router.get('/new', (req, res) => {
  res.render('onlineTutors/create');
});

// 생성 처리
router.post('/new', async (req, res) => {
  req.body['@type'] = 'Online_Tutors';
  await OnlineTutor.create(req.body);
  res.redirect('/online-tutors');
});

// 수정 폼
router.get('/edit/:id', async (req, res) => {
  const tutor = await OnlineTutor.findById(req.params.id);
  res.render('onlineTutors/edit', { tutor });
});

// 수정 처리
router.post('/edit/:id', async (req, res) => {
  await OnlineTutor.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/online-tutors');
});

// 삭제
router.get('/delete/:id', async (req, res) => {
  await OnlineTutor.findByIdAndDelete(req.params.id);
  res.redirect('/online-tutors');
});

// ✅ /create 경로에서도 접근 가능하게 redirect
router.get('/create', (req, res) => {
  res.redirect('/online-tutors/new');
});

router.post('/create', (req, res) => {
  res.redirect(307, '/online-tutors/new'); // POST 요청도 유지해서 전달
});

module.exports = router;
