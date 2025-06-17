const express = require('express');
const router = express.Router();
const JobSeeker = require('../model/jobSeeker');
const sanitizeHtml = require('sanitize-html');

// ✅ 공통 필드 추출 함수
async function getDistinctFields() {
  const [countries, majors, locations] = await Promise.all([
    JobSeeker.distinct('nationality'),
    JobSeeker.distinct('major'),
    JobSeeker.distinct('preferredWorkLocation')
  ]);
  return { countries, majors, locations };
}

// ✅ 목록
router.get('/', async (req, res) => {
  try {
    const seekers = await JobSeeker.find().sort({ createdAt: -1 });
    res.render('jobSeeker/index', { seekers });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching job seekers');
  }
});

// ✅ 새 이력서 폼
router.get('/new', async (req, res) => {
  try {
    const { countries, majors, locations } = await getDistinctFields();
    res.render('jobSeeker/new', { countries, majors, locations });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading form');
  }
});

// ✅ 새 이력서 저장
router.post('/', async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      jobTitle: sanitizeHtml(req.body.jobTitle || ''),
      description: sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} }),
      email: req.body.email,
      nationality: req.body.nationality,
      preferredWorkLocation: req.body.preferredWorkLocation,
      major: req.body.major,
      languageSpoken: req.body.languageSpoken,
      educationBackground: req.body.educationBackground,
      availableFrom: req.body.availableFrom
    };
    const newSeeker = new JobSeeker(data);
    await newSeeker.save();
    res.redirect('/job-seekers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving job seeker');
  }
});

// ✅ 수정 폼
router.get('/:id/edit', async (req, res) => {
  try {
    const seeker = await JobSeeker.findById(req.params.id);
    if (!seeker) return res.status(404).send('Job Seeker not found');

    const { countries, majors, locations } = await getDistinctFields();
    res.render('jobSeeker/edit', { jobSeeker: seeker, countries, majors, locations });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading edit form');
  }
});

// ✅ 수정 처리
router.put('/:id', async (req, res) => {
  try {
    const seeker = await JobSeeker.findById(req.params.id);
    if (!seeker) return res.status(404).send('Job Seeker not found');

    seeker.name = req.body.name;
    seeker.jobTitle = sanitizeHtml(req.body.jobTitle || '');
    seeker.description = sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} });
    seeker.email = req.body.email;
    seeker.nationality = req.body.nationality;
    seeker.preferredWorkLocation = req.body.preferredWorkLocation;
    seeker.major = req.body.major;
    seeker.languageSpoken = req.body.languageSpoken;
    seeker.educationBackground = req.body.educationBackground;
    seeker.availableFrom = req.body.availableFrom;

    await seeker.save();
    res.redirect('/job-seekers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating job seeker');
  }
});

// ✅ 삭제
router.get('/:id/delete', async (req, res) => {
  try {
    await JobSeeker.findByIdAndDelete(req.params.id);
    res.redirect('/job-seekers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting job seeker');
  }
});

module.exports = router;
