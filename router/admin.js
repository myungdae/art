// router/admin.js  (Full revised version)
const express = require('express');
const router = express.Router();

const User = require('../model/user');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');
const requireAdmin = require('../middleware/requireAdmin');

/* ---------------------- Helpers ---------------------- */
const toKST = (d) => {
  if (!d) return '—';
  try {
    const k = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000); // UTC+9
    return k.toISOString().replace('T', ' ').slice(0, 16); // 'YYYY-MM-DD HH:mm'
  } catch {
    return '—';
  }
};

const daysRemainingFromDoc = (doc) => {
  const now = new Date();
  // 1) resumeAccess { startDate, durationDays } 우선
  if (doc?.resumeAccess?.startDate && doc?.resumeAccess?.durationDays) {
    const start = new Date(doc.resumeAccess.startDate);
    const end = new Date(start.getTime() + doc.resumeAccess.durationDays * 86400000);
    const diff = Math.ceil((end - now) / 86400000);
    return diff > 0 ? diff : 0;
  }
  // 2) expiresAt (레거시/테스트 레코드)
  if (doc?.expiresAt) {
    const end = new Date(doc.expiresAt);
    const diff = Math.ceil((end - now) / 86400000);
    return diff > 0 ? diff : 0;
  }
  return 0;
};

/* ---------------------- Auth Views ---------------------- */
router.get('/login', (req, res) => {
  res.render('admin/login');
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (email === adminEmail && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  return res.render('admin/login', { error: 'Invalid email or password.' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

/* ---------------------- Dashboard ---------------------- */
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    /* ===== EMPLOYERS: dedup by email, newest wins; show all (no adsAvailable filter) ===== */
    const rawEmployers = await User.aggregate([
      { $match: { role: 'Employer' } },
      { $sort: { email: 1, createdAt: -1 } },             // email 그룹 내부에서 최신 먼저
      {
        $group: {
          _id: '$email',
          username: { $first: '$username' },
          email: { $first: '$email' },
          adsAvailable: { $first: { $ifNull: ['$adsAvailable', 0] } },
          createdAt: { $first: '$createdAt' }
        }
      },
      { $sort: { createdAt: -1 } }                         // 테이블 정렬: 최신 가입 순
    ]);

    const employers = rawEmployers.map(e => ({
      username: e.username || '—',
      email: e.email || '—',
      remainingTokens: Number(e.adsAvailable || 0),
      createdAtDisplay: toKST(e.createdAt)
    }));

    /* ===== JOB SEEKERS: dedup by email; support resumeAccess or expiresAt ===== */
    const rawSeekers = await JobSeeker.aggregate([
      { $match: {} },
      { $sort: { email: 1, createdAt: -1 } },
      {
        $group: {
          _id: '$email',
          username: { $first: '$username' },
          name: { $first: '$name' },
          email: { $first: '$email' },
          createdAt: { $first: '$createdAt' },
          expiresAt: { $first: '$expiresAt' },
          resumeAccess: { $first: '$resumeAccess' }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const jobSeekers = rawSeekers.map(js => ({
      username: js.name || js.username || '—',
      email: js.email || '—',
      remainingDays: daysRemainingFromDoc(js),
      expiresAtDisplay: js.expiresAt ? toKST(js.expiresAt) : '—',
      createdAtDisplay: toKST(js.createdAt)
    }));

    /* ===== ONLINE TUTORS: same treatment ===== */
    const rawTutors = await OnlineTutor.aggregate([
      { $match: {} },
      { $sort: { email: 1, createdAt: -1 } },
      {
        $group: {
          _id: '$email',
          username: { $first: '$username' },
          name: { $first: '$name' },
          email: { $first: '$email' },
          createdAt: { $first: '$createdAt' },
          expiresAt: { $first: '$expiresAt' },
          resumeAccess: { $first: '$resumeAccess' }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const onlineTutors = rawTutors.map(ot => ({
      username: ot.username || ot.name || '—',
      email: ot.email || '—',
      remainingDays: daysRemainingFromDoc(ot),
      expiresAtDisplay: ot.expiresAt ? toKST(ot.expiresAt) : '—',
      createdAtDisplay: toKST(ot.createdAt)
    }));

    res.render('admin/dashboard', { employers, jobSeekers, onlineTutors });
  } catch (err) {
    console.error('❌ Admin dashboard error:', err);
    res.status(500).render('error', {
      message: 'Admin Dashboard Error',
      error: err
    });
  }
});

module.exports = router;
