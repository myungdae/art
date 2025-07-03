const express = require('express');
const router = express.Router();
const JobSeeker = require('../model/jobSeeker');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');

// ✅ 목록 (로그인 필수)
router.get('/', requireLogin, async (req, res) => {
  try {
    const seekers = await JobSeeker.find().sort({ createdAt: -1 });
    res.render('jobSeeker/index', { seekers });
  } catch (err) {
    console.error('❌ Error fetching job seekers:', err.message);
    res.status(500).send('❌ Error fetching job seekers');
  }
});

// ✅ 새 이력서 폼
router.get('/new', requireLogin, async (req, res) => {
  try {
    const [countries, majors, locations] = await Promise.all([
      JobSeeker.distinct('nationality'),
      JobSeeker.distinct('major'),
      JobSeeker.distinct('preferredWorkLocation')
    ]);
    res.render('jobSeeker/new', { countries, majors, locations });
  } catch (err) {
    console.error('❌ Error loading form:', err.message);
    res.status(500).send('❌ Error loading form');
  }
});

// ✅ 새 이력서 저장
router.post('/', requireLogin, async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      jobTitle: sanitizeHtml(req.body.jobTitle || ''),
      description: sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} }),
      email: req.body.email,
      nationality: req.body.nationality || req.body.customNationality,
      preferredWorkLocation: req.body.preferredWorkLocation || req.body.customPreferredWorkLocation,
      major: req.body.major || req.body.customMajor,
      languageSpoken: req.body.languageSpoken,
      educationBackground: req.body.educationBackground,
      availableFrom: req.body.availableFrom
    };
    const newSeeker = new JobSeeker(data);
    await newSeeker.save();
    res.redirect('/facet/Job_Seekers');
  } catch (err) {
    console.error('❌ Error saving job seeker:', err.message);
    res.status(500).send('❌ Error saving job seeker');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const seeker = await JobSeeker.findById(req.params.id);
    if (!seeker) return res.status(404).send('❌ Job Seeker not found');
    const [countries, majors, locations] = await Promise.all([
      JobSeeker.distinct('nationality'),
      JobSeeker.distinct('major'),
      JobSeeker.distinct('preferredWorkLocation')
    ]);
    res.render('jobSeeker/edit', { jobSeeker: seeker, countries, majors, locations });
  } catch (err) {
    console.error('❌ Error loading edit form:', err.message);
    res.status(500).send('❌ Error loading edit form');
  }
});

// ✅ 수정 처리
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const seeker = await JobSeeker.findById(req.params.id);
    if (!seeker) return res.status(404).send('❌ Job Seeker not found');
    seeker.name = req.body.name;
    seeker.jobTitle = sanitizeHtml(req.body.jobTitle || '');
    seeker.description = sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} });
    seeker.email = req.body.email;
    seeker.nationality = req.body.nationality || req.body.customNationality;
    seeker.preferredWorkLocation = req.body.preferredWorkLocation || req.body.customPreferredWorkLocation;
    seeker.major = req.body.major || req.body.customMajor;
    seeker.languageSpoken = req.body.languageSpoken;
    seeker.educationBackground = req.body.educationBackground;
    seeker.availableFrom = req.body.availableFrom;
    await seeker.save();
    res.redirect('/facet/Job_Seekers');
  } catch (err) {
    console.error('❌ Error updating job seeker:', err.message);
    res.status(500).send('❌ Error updating job seeker');
  }
});

// ✅ 삭제
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    await JobSeeker.findByIdAndDelete(req.params.id);
    res.redirect('/facet/Job_Seekers');
  } catch (err) {
    console.error('❌ Error deleting job seeker:', err.message);
    res.status(500).send('❌ Error deleting job seeker');
  }
});

module.exports = router;
