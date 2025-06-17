const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const User = require('../model/user');
const sanitizeHtml = require('sanitize-html');
const priceConfig = require('../config/priceConfig');
const { requireLogin } = require('../middleware/auth');
const requireEmployer = require('../middleware/requireEmployer');

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

console.log("✅ jobVacancyRouter loaded");

// ✅ 공통 필드값 추출
const getDistinctValues = async () => {
  const [studentTypesFromDB, countriesFromDB, teachingAreasFromDB] = await Promise.all([
    JobVacancy.distinct('studentType'),
    JobVacancy.distinct('country'),
    JobVacancy.distinct('teachingArea')
  ]);

  const defaultCountries = ['USA', 'South Korea', 'Japan', 'Vietnam', 'China'];
  const defaultStudentTypes = ['Adults', 'Elementary', 'High School'];
  const defaultTeachingAreas = ['ESL', 'English', 'Math', 'Science'];

  return {
    countries: [...new Set([...defaultCountries, ...countriesFromDB])].sort(),
    studentTypes: [...new Set([...defaultStudentTypes, ...studentTypesFromDB])].sort(),
    teachingAreas: [...new Set([...defaultTeachingAreas, ...teachingAreasFromDB])].sort()
  };
};

const htmlSanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['style', 'class'] },
  allowedSchemes: ['http', 'https']
};

// ✅ 목록 조회
router.get('/', async (req, res) => {
  try {
    const jobs = await JobVacancy.find().populate('user');
    res.render('jobVacancy/index', {
      jobs,
      session: req.session
    });
  } catch (err) {
    console.error('❌ Failed to load job list:', err);
    res.status(500).send('Server error');
  }
});

// ✅ 신규 등록 (결제 유도)
router.get('/new', requireLogin, requireEmployer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user && user.adsAvailable > 0) {
      return res.redirect('/job-vacancies/new_paid_user');
    }

    const values = await getDistinctValues();
    res.render('jobVacancy/new', {
      message: null,
      showPayment: true,
      ...values,
      priceOptions: priceConfig
    });
  } catch (err) {
    console.error('[ERROR - GET /new]:', err);
    res.status(500).send('❌ Failed to load posting page.');
  }
});

// ✅ 등록 폼 (결제 후 접근용)
router.get('/new_paid_user', requireLogin, requireEmployer, async (req, res) => {
  const values = await getDistinctValues();
  res.render('jobVacancy/new_paid_user', {
    ...values
  });
});

// ✅ 등록 처리 (결제 후)
router.post('/new_paid_user', requireLogin, requireEmployer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.adsAvailable <= 0) {
      return res.status(403).send('❌ No available ad slots');
    }

    const { title, description, ...rest } = req.body;
    const cleanTitle = title.trim();

    if (!cleanTitle) return res.status(400).send('❌ Title is required');
    if (/[😀-🙏]/u.test(cleanTitle)) {
      return res.status(400).send('❌ Title cannot include emojis');
    }

    const exists = await JobVacancy.findOne({ title: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') });
    if (exists) return res.status(400).send('❌ Duplicate title exists');

    const job = new JobVacancy({
      title: cleanTitle,
      description: sanitizeHtml(description || '', htmlSanitizeOptions),
      ...rest,
      addResumeAccess: rest.resumeAccess === 'yes',
      user: req.user._id
    });

    await job.save();
    await User.findByIdAndUpdate(req.user._id, { $inc: { adsAvailable: -1 } });

    res.redirect(`/job-vacancies/${job._id}?success=true`);
  } catch (err) {
    console.error('[ERROR - POST /new_paid_user]:', err);
    res.status(500).send('❌ Failed to post paid job');
  }
});

// ✅ 광고 상세 보기
router.get('/:id', async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id).populate('user');
    if (!jobVacancy) {
      return res.status(404).render('jobVacancy/show', {
        jobVacancy: null,
        success: false
      });
    }

    res.render('jobVacancy/show', {
      jobVacancy,
      success: req.query.success === 'true'
    });
  } catch (err) {
    console.error('[ERROR - GET /:id]:', err);
    res.status(500).send('❌ Error loading job ad');
  }
});

// ✅ 광고 수정 폼
router.get('/:id/edit', requireLogin, async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id).populate('user');
    if (!jobVacancy) return res.status(404).send('❌ Job not found');
    if (!jobVacancy.user || !jobVacancy.user._id.equals(req.user._id)) {
      return res.status(403).send('❌ Unauthorized');
    }

    const values = await getDistinctValues();
    const datePostedFormatted = jobVacancy.datePosted
      ? jobVacancy.datePosted.toISOString().substring(0, 10)
      : '';

    res.render('jobVacancy/edit', {
      jobVacancy: { ...jobVacancy.toObject(), isNew: false },
      datePostedFormatted,
      ...values
    });
  } catch (err) {
    console.error('[ERROR - GET /:id/edit]:', err);
    res.status(500).send('❌ Error loading edit form');
  }
});

// ✅ 광고 수정 처리
router.post('/:id/edit', requireLogin, async (req, res) => {
  try {
    const jobVacancy = await JobVacancy.findById(req.params.id).populate('user');
    if (!jobVacancy) return res.status(404).send('❌ Job not found');
    if (!jobVacancy.user || !jobVacancy.user._id.equals(req.user._id)) {
      return res.status(403).send('❌ Unauthorized');
    }

    const { title, description, ...rest } = req.body;
    const cleanTitle = (title || '').trim();

    if (!cleanTitle) return res.status(400).send('❌ Title is required');
    if (/[😀-🙏]/u.test(cleanTitle)) {
      return res.status(400).send('❌ Title cannot include emojis');
    }

    const existing = await JobVacancy.findOne({
      _id: { $ne: jobVacancy._id },
      title: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i')
    });
    if (existing) return res.status(400).send('❌ Duplicate title exists');

    jobVacancy.title = cleanTitle;
    jobVacancy.description = sanitizeHtml(description || '', htmlSanitizeOptions);
    jobVacancy.country = rest.country || '';
    jobVacancy.studentType = rest.studentType || '';
    jobVacancy.teachingArea = rest.teachingArea || '';
    jobVacancy.duration = rest.duration || '';
    jobVacancy.pay = rest.pay || '';
    jobVacancy.housing = rest.housing || '';
    jobVacancy.email = rest.email || '';
    jobVacancy.companyName = rest.companyName || '';
    jobVacancy.jobLocation = rest.jobLocation || '';
    jobVacancy.cellphoneNumber = rest.cellphoneNumber || '';
    jobVacancy.skypeId = rest.skypeId || '';
    jobVacancy.wechatId = rest.wechatId || '';
    jobVacancy.homepage = rest.homepage || '';
    jobVacancy.datePosted = rest.datePosted ? new Date(rest.datePosted) : null;
    jobVacancy.adPackage = rest.adPackage || '';
    jobVacancy.addResumeAccess = rest.addResumeAccess === 'yes';

    await jobVacancy.save();
    res.redirect('/user/mypage');
  } catch (err) {
    console.error('[ERROR - POST /:id/edit]:', err);
    res.status(500).send('❌ Failed to update job');
  }
});

// ✅ 광고 삭제
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const ad = await JobVacancy.findById(req.params.id).populate('user');
    if (!ad) return res.status(404).send('❌ Ad not found');
    if (!ad.user || !ad.user._id.equals(req.user._id)) {
      return res.status(403).send('❌ Unauthorized');
    }

    await ad.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { $inc: { adsAvailable: 1 } });

    res.redirect('/user/mypage');
  } catch (err) {
    console.error('[ERROR - DELETE /:id]:', err);
    res.status(500).send('❌ Error deleting job ad');
  }
});

module.exports = router;
