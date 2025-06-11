const express = require('express');
const router = express.Router();
const JobSeeker = require('../model/jobSeeker');

console.log('✅ JobSeeker router loaded');

// GET: Create Form
router.get('/new', (req, res) => {
  res.render('jobSeeker/new');
});

// POST: Submit Form
router.post('/new', async (req, res) => {
  try {
    const {
      jobTitle,
      description,
      name,
      email,
      nationality,
      preferredWorkLocation,
      major,
      languageSpoken,
      availableFrom
    } = req.body;

    const seeker = new JobSeeker({
      jobTitle,
      description,
      name,
      email,
      nationality,
      preferredWorkLocation,
      major,
      languageSpoken,
      availableFrom
    });

    await seeker.save();
    console.log('✅ Job Seeker created:', seeker._id);
    res.redirect('/job-seekers');
  } catch (err) {
    console.error('❌ Error saving Job Seeker:', err);
    res.status(500).send('Internal server error');
  }
});

// 목록 라우트 추가
router.get('/', async (req, res) => {
  try {
    const seekers = await JobSeeker.find().sort({ availableFrom: 1 }); // 날짜순 정렬 (옵션)
    res.render('jobSeeker/index', { seekers });
  } catch (err) {
    console.error('❌ 목록 불러오기 실패:', err);
    res.status(500).send('Server Error');
  }
});

// GET: Edit Form
router.get('/:id/edit', async (req, res) => {
  const seeker = await JobSeeker.findById(req.params.id);
  if (!seeker) return res.status(404).send('Not Found');
  res.render('jobSeeker/edit', { seeker });
});

// POST: Submit Edits
router.post('/:id/edit', async (req, res) => {
  const { jobTitle, description, name, email, nationality, preferredWorkLocation, major, languageSpoken, availableFrom } = req.body;

  await JobSeeker.findByIdAndUpdate(req.params.id, {
    jobTitle,
    description,
    name,
    email,
    nationality,
    preferredWorkLocation,
    major,
    languageSpoken,
    availableFrom,
  });

  res.redirect('/job-seekers');
});

// GET: Delete Job Seeker
router.get('/:id/delete', async (req, res) => {
  try {
    await JobSeeker.findByIdAndDelete(req.params.id);
    console.log(`✅ Deleted Job Seeker: ${req.params.id}`);
    res.redirect('/job-seekers');
  } catch (err) {
    console.error('❌ Error deleting job seeker:', err);
    res.status(500).send('Error deleting job seeker');
  }
});


module.exports = router;

