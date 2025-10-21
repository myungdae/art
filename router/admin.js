// router/admin.js  (FULL DROP-IN, dedupe + id 포함 + KST 포맷)
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
  if (doc?.resumeAccess?.startDate && typeof doc?.resumeAccess?.durationDays === 'number') {
    const start = new Date(doc.resumeAccess.startDate);
    const end = new Date(start.getTime() + doc.resumeAccess.durationDays * 86400000);
    const diff = Math.ceil((end - now) / 86400000);
    return diff > 0 ? diff : 0;
  }
  // 2) expiresAt (레거시)
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
    /* ===== EMPLOYERS: Get all Employer users ===== */
    const allEmployers = await User.find({ role: 'Employer' })
      .sort({ createdAt: -1 })
      .lean();

    const employers = allEmployers.map(e => ({
      id: e._id,
      username: e.username || '—',
      email: e.email || '—',
      remainingTokens: Number(e.adsAvailable || 0),
      hasCredits: Number(e.adsAvailable || 0) > 0,
      createdAtDisplay: toKST(e.createdAt)
    }));

    /* ===== JOB SEEKERS: Get all Job_Seeker users with resumeAccess ===== */
    const allJobSeekers = await User.find({ role: 'Job_Seeker' })
      .sort({ createdAt: -1 })
      .lean();

    const jobSeekers = allJobSeekers.map(js => {
      const remainingDays = daysRemainingFromDoc({ resumeAccess: js.resumeAccess });
      return {
        id: js._id,
        username: js.username || '—',
        email: js.email || '—',
        remainingDays,
        isActive: remainingDays > 0,
        expiresAtDisplay: js.resumeAccess?.startDate 
          ? toKST(new Date(new Date(js.resumeAccess.startDate).getTime() + (js.resumeAccess.durationDays || 0) * 86400000))
          : '—',
        createdAtDisplay: toKST(js.createdAt)
      };
    });

    /* ===== ONLINE TUTORS: Get all Online_Tutor users ===== */
    const allTutors = await User.find({ role: 'Online_Tutor' })
      .sort({ createdAt: -1 })
      .lean();

    const onlineTutors = allTutors.map(ot => {
      const remainingDays = daysRemainingFromDoc({ resumeAccess: ot.tutorAccess });
      return {
        id: ot._id,
        username: ot.username || '—',
        email: ot.email || '—',
        remainingDays,
        isActive: remainingDays > 0,
        expiresAtDisplay: ot.tutorAccess?.startDate 
          ? toKST(new Date(new Date(ot.tutorAccess.startDate).getTime() + (ot.tutorAccess.durationDays || 0) * 86400000))
          : '—',
        createdAtDisplay: toKST(ot.createdAt)
      };
    });

    /* ===== STATISTICS ===== */
    const stats = {
      employers: {
        total: employers.length,
        withCredits: employers.filter(e => e.hasCredits).length,
        withoutCredits: employers.filter(e => !e.hasCredits).length
      },
      jobSeekers: {
        total: jobSeekers.length,
        active: jobSeekers.filter(js => js.isActive).length,
        inactive: jobSeekers.filter(js => !js.isActive).length
      },
      onlineTutors: {
        total: onlineTutors.length,
        active: onlineTutors.filter(ot => ot.isActive).length,
        inactive: onlineTutors.filter(ot => !ot.isActive).length
      }
    };

    res.render('admin/dashboard', { employers, jobSeekers, onlineTutors, stats });
  } catch (err) {
    console.error('❌ Admin dashboard error:', err);
    res.status(500).render('error', {
      message: 'Admin Dashboard Error',
      error: err
    });
  }
});

/* ---------------------- Bulk Delete Inactive/No Credits Users ---------------------- */
router.post('/delete-inactive', requireAdmin, async (req, res) => {
  try {
    const { userType } = req.body;

    let deleteResult = { deletedCount: 0 };
    let deletedUsers = [];

    if (userType === 'employers') {
      // Delete Employers with no credits
      const employersToDelete = await User.find({ 
        role: 'Employer',
        $or: [
          { adsAvailable: { $exists: false } },
          { adsAvailable: null },
          { adsAvailable: 0 }
        ]
      }).lean();

      deletedUsers = employersToDelete.map(e => e.email);
      deleteResult = await User.deleteMany({ 
        _id: { $in: employersToDelete.map(e => e._id) }
      });
    } 
    else if (userType === 'jobseekers') {
      // Delete Job Seekers with no active access
      const allJobSeekers = await User.find({ role: 'Job_Seeker' }).lean();
      const inactiveJobSeekers = allJobSeekers.filter(js => {
        const remainingDays = daysRemainingFromDoc({ resumeAccess: js.resumeAccess });
        return remainingDays <= 0;
      });

      deletedUsers = inactiveJobSeekers.map(js => js.email);
      deleteResult = await User.deleteMany({ 
        _id: { $in: inactiveJobSeekers.map(js => js._id) }
      });

      // Also delete their JobSeeker profiles if any
      await JobSeeker.deleteMany({ 
        email: { $in: deletedUsers }
      });
    } 
    else if (userType === 'tutors') {
      // Delete Tutors with no active access
      const allTutors = await User.find({ role: 'Online_Tutor' }).lean();
      const inactiveTutors = allTutors.filter(ot => {
        const remainingDays = daysRemainingFromDoc({ resumeAccess: ot.tutorAccess });
        return remainingDays <= 0;
      });

      deletedUsers = inactiveTutors.map(ot => ot.email);
      deleteResult = await User.deleteMany({ 
        _id: { $in: inactiveTutors.map(ot => ot._id) }
      });

      // Also delete their OnlineTutor profiles if any
      await OnlineTutor.deleteMany({ 
        email: { $in: deletedUsers }
      });
    }

    console.log(`✅ Deleted ${deleteResult.deletedCount} inactive ${userType}:`, deletedUsers);

    res.json({ 
      success: true, 
      deletedCount: deleteResult.deletedCount,
      deletedUsers,
      message: `Successfully deleted ${deleteResult.deletedCount} inactive ${userType}`
    });
  } catch (err) {
    console.error('❌ Delete inactive users error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

module.exports = router;
