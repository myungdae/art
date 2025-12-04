// router/admin.js  (FULL DROP-IN, dedupe + id 포함 + KST 포맷)
const express = require('express');
const router = express.Router();

const User = require('../model/user');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');
const requireAdmin = require('../middleware/requireAdmin');
const priceConfig = require('../config/priceConfig');
const resumePriceConfig = require('../config/resumePriceConfig');
const tutorPriceConfig = require('../config/tutorPriceConfig');

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

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Check .env hardcoded admin first
  if (email === adminEmail && password === adminPassword) {
    req.session.isAdmin = true;
    req.session.lastActivity = Date.now();
    return res.redirect('/admin/dashboard');
  }

  // Check database for Admin role users
  try {
    const user = await User.findOne({ email, role: 'Admin' });
    if (user && user.password === password) {
      req.session.isAdmin = true;
      req.session.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: 'Admin'
      };
      req.session.lastActivity = Date.now();
      return res.redirect('/admin/dashboard');
    }
  } catch (err) {
    console.error('Admin login error:', err);
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

    res.render('admin/dashboard', {
      currentPage: 'overview',
      pageTitle: 'Dashboard Overview',
      employers,
      jobSeekers,
      onlineTutors,
      stats,
      employerCount: stats.employers.total,
      jobSeekerCount: stats.jobSeekers.total,
      tutorCount: stats.onlineTutors.total
    });
  } catch (err) {
    console.error('❌ Admin dashboard error:', err);
    res.status(500).render('error', {
      message: 'Admin Dashboard Error',
      error: err
    });
  }
});

/* ---------------------- Delete Single User ---------------------- */
router.post('/delete-user', requireAdmin, async (req, res) => {
  try {
    const { userId, userType } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Find user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    // Delete related profiles
    if (user.role === 'Job_Seeker') {
      await JobSeeker.deleteMany({ email: user.email });
    } else if (user.role === 'Online_Tutor') {
      await OnlineTutor.deleteMany({ email: user.email });
    }

    console.log(`✅ Deleted user: ${user.email} (${user.role})`);

    res.json({
      success: true,
      message: `Successfully deleted user: ${user.email}`,
      deletedUser: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('❌ Delete user error:', err);
    res.status(500).json({
      success: false,
      error: err.message
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

/* ---------------------- Revenue Management ---------------------- */
router.get('/revenue', requireAdmin, async (req, res) => {
  try {
    const Payment = require('../model/payment');
    
    // Calculate total revenue
    const totalRevenueResult = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;
    
    // Calculate monthly revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyRevenueResult = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
    
    // Total transactions
    const totalTransactions = await Payment.countDocuments({ status: 'paid' });
    
    // Average transaction
    const averageTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
    
    // Recent transactions
    const recentTransactions = await Payment.find({ status: 'paid' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Revenue chart data (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const revenueByDay = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const revenueChartLabels = revenueByDay.map(d => d._id);
    const revenueChartData = revenueByDay.map(d => d.total);
    
    // Package type breakdown
    const packageBreakdown = await Payment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: '$packageType',
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const packageChartLabels = packageBreakdown.map(p => {
      const labels = {
        'job_ads': 'Job Ads',
        'resume_access': 'Resume Access',
        'tutor_access': 'Tutor Access'
      };
      return labels[p._id] || p._id;
    });
    const packageChartData = packageBreakdown.map(p => p.total);
    
    // User type breakdown
    const userTypeBreakdown = await Payment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: '$userRole',
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const userTypeChartLabels = userTypeBreakdown.map(u => {
      const labels = {
        'Employer': 'Employers',
        'Job_Seeker': 'Job Seekers',
        'Online_Tutor': 'Tutors'
      };
      return labels[u._id] || u._id;
    });
    const userTypeChartData = userTypeBreakdown.map(u => u.total);
    
    res.render('admin/revenue', {
      currentPage: 'revenue',
      pageTitle: 'Revenue Management',
      totalRevenue,
      monthlyRevenue,
      totalTransactions,
      averageTransaction,
      recentTransactions,
      revenueChartLabels,
      revenueChartData,
      packageChartLabels,
      packageChartData,
      userTypeChartLabels,
      userTypeChartData
    });
  } catch (err) {
    console.error('❌ Revenue page error:', err);
    res.status(500).render('error', {
      message: 'Revenue Management Error',
      error: err
    });
  }
});

/* ---------------------- User Management ---------------------- */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    /* ===== EMPLOYERS ===== */
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

    /* ===== JOB SEEKERS ===== */
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

    /* ===== ONLINE TUTORS ===== */
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

    res.render('admin/users', {
      currentPage: 'users',
      pageTitle: 'User Management',
      employers,
      jobSeekers,
      onlineTutors,
      stats
    });
  } catch (err) {
    console.error('❌ Users page error:', err);
    res.status(500).render('error', {
      message: 'User Management Error',
      error: err
    });
  }
});

/* ---------------------- Revenue Sub-pages ---------------------- */
router.get('/revenue/transactions', requireAdmin, async (req, res) => {
  try {
    const Payment = require('../model/payment');
    
    // Get all transactions with user details
    const transactions = await Payment.find()
      .populate('userId', 'username email role')
      .sort({ createdAt: -1 })
      .lean();

    const formattedTransactions = transactions.map(t => ({
      id: t._id,
      paymentId: t.paymentId,
      merchantUid: t.merchantUid,
      userName: t.userId?.username || t.userEmail,
      userEmail: t.userEmail,
      userRole: t.userRole,
      amount: t.amount,
      currency: t.currency || 'KRW',
      paymentMethod: t.paymentMethod,
      packageType: t.packageType,
      packageDescription: t.packageDetails?.description || '-',
      status: t.status,
      paidAt: toKST(t.paidAt),
      createdAt: toKST(t.createdAt),
      refundRequest: t.refundRequest,
      hasRefundRequest: t.refundRequest && t.refundRequest.status === 'pending'
    }));

    // Statistics
    const totalTransactions = transactions.length;
    const paidTransactions = transactions.filter(t => t.status === 'paid');
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const avgTransaction = paidTransactions.length > 0 
      ? Math.round(totalRevenue / paidTransactions.length) 
      : 0;

    res.render('admin/transactions', {
      currentPage: 'transactions',
      pageTitle: 'Transactions',
      transactions: formattedTransactions,
      stats: {
        total: totalTransactions,
        paid: paidTransactions.length,
        pending: transactions.filter(t => t.status === 'pending').length,
        failed: transactions.filter(t => t.status === 'failed').length,
        refunded: transactions.filter(t => t.status === 'refunded').length,
        refundRequests: transactions.filter(t => t.refundRequest && t.refundRequest.status === 'pending').length,
        totalRevenue,
        avgTransaction
      }
    });
  } catch (err) {
    console.error('❌ Transactions page error:', err);
    res.status(500).render('error', {
      message: 'Transactions Error',
      error: err
    });
  }
});

router.get('/revenue/analytics', requireAdmin, async (req, res) => {
  try {
    const Payment = require('../model/payment');
    
    // Get paid payments only
    const payments = await Payment.find({ status: 'paid' })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate analytics
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Revenue by month (last 6 months)
    const monthlyRevenue = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = 0;
    }
    
    payments.forEach(p => {
      const date = new Date(p.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyRevenue.hasOwnProperty(key)) {
        monthlyRevenue[key] += p.amount || 0;
      }
    });

    // Revenue by package type
    const revenueByPackage = {
      job_ads: 0,
      resume_access: 0,
      tutor_access: 0
    };
    
    payments.forEach(p => {
      if (revenueByPackage.hasOwnProperty(p.packageType)) {
        revenueByPackage[p.packageType] += p.amount || 0;
      }
    });

    // Revenue by user role
    const revenueByRole = {
      Employer: 0,
      Job_Seeker: 0,
      Online_Tutor: 0
    };
    
    payments.forEach(p => {
      if (revenueByRole.hasOwnProperty(p.userRole)) {
        revenueByRole[p.userRole] += p.amount || 0;
      }
    });

    // Top payment methods
    const paymentMethods = {};
    payments.forEach(p => {
      const method = p.paymentMethod || 'UNKNOWN';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });

    res.render('admin/analytics', {
      currentPage: 'analytics',
      pageTitle: 'Revenue Analytics',
      stats: {
        totalRevenue,
        totalTransactions: payments.length,
        avgTransaction: payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0
      },
      monthlyRevenue,
      revenueByPackage,
      revenueByRole,
      paymentMethods
    });
  } catch (err) {
    console.error('❌ Analytics page error:', err);
    res.status(500).render('error', {
      message: 'Analytics Error',
      error: err
    });
  }
});

/* ---------------------- User Management Sub-pages ---------------------- */
router.get('/users/employers', requireAdmin, async (req, res) => {
  try {
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

    const stats = {
      total: employers.length,
      withCredits: employers.filter(e => e.hasCredits).length,
      withoutCredits: employers.filter(e => !e.hasCredits).length,
      totalCredits: employers.reduce((sum, e) => sum + e.remainingTokens, 0)
    };

    res.render('admin/users_employers', {
      currentPage: 'employers',
      pageTitle: 'Employers',
      employers,
      stats
    });
  } catch (err) {
    console.error('❌ Employers page error:', err);
    res.status(500).render('error', {
      message: 'Employers Management Error',
      error: err
    });
  }
});

router.get('/users/job-seekers', requireAdmin, async (req, res) => {
  try {
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

    const stats = {
      total: jobSeekers.length,
      active: jobSeekers.filter(js => js.isActive).length,
      inactive: jobSeekers.filter(js => !js.isActive).length
    };

    res.render('admin/users_jobseekers', {
      currentPage: 'job-seekers',
      pageTitle: 'Job Seekers',
      jobSeekers,
      stats
    });
  } catch (err) {
    console.error('❌ Job Seekers page error:', err);
    res.status(500).render('error', {
      message: 'Job Seekers Management Error',
      error: err
    });
  }
});

router.get('/users/tutors', requireAdmin, async (req, res) => {
  try {
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

    const stats = {
      total: onlineTutors.length,
      active: onlineTutors.filter(ot => ot.isActive).length,
      inactive: onlineTutors.filter(ot => !ot.isActive).length
    };

    res.render('admin/users_tutors', {
      currentPage: 'tutors',
      pageTitle: 'Online Tutors',
      onlineTutors,
      stats
    });
  } catch (err) {
    console.error('❌ Tutors page error:', err);
    res.status(500).render('error', {
      message: 'Tutors Management Error',
      error: err
    });
  }
});

/* ---------------------- Settings Page ---------------------- */
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    // Get system statistics
    const totalUsers = await User.countDocuments();
    const employers = await User.countDocuments({ role: 'Employer' });
    const jobSeekers = await User.countDocuments({ role: 'Job_Seeker' });
    const tutors = await User.countDocuments({ role: 'Online_Tutor' });

    // Get payment statistics (if Payment model exists)
    let totalRevenue = 0;
    let totalTransactions = 0;
    try {
      const Payment = require('../model/payment');
      const revenueResult = await Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
      totalTransactions = await Payment.countDocuments({ status: 'paid' });
    } catch (err) {
      console.log('ℹ️ Payment statistics not available:', err.message);
    }

    // Get environment variables (safe ones only)
    const config = {
      nodeEnv: process.env.NODE_ENV || 'development',
      portOneStoreId: process.env.PORTONE_STORE_ID || 'Not configured',
      portOneTestMode: process.env.PORTONE_TEST_MODE === 'true',
      adminEmail: process.env.ADMIN_EMAIL || 'Not configured',
      mongoUri: process.env.MONGO_URI ? '✓ Configured' : '✗ Not configured',
      sessionSecret: process.env.SESSION_SECRET ? '✓ Configured' : '✗ Not configured'
    };

    // Get database info
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStateText = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };

    res.render('admin/settings', {
      currentPage: 'settings',
      pageTitle: 'System Settings',
      stats: {
        totalUsers,
        employers,
        jobSeekers,
        tutors,
        totalRevenue,
        totalTransactions
      },
      config,
      database: {
        state: dbStateText[dbState] || 'Unknown',
        connected: dbState === 1
      },
      priceConfig,
      resumePriceConfig,
      tutorPriceConfig
    });
  } catch (err) {
    console.error('❌ Settings page error:', err);
    res.status(500).render('error', {
      message: 'Settings Error',
      error: err
    });
  }
});

/* -------------------------------------------------------------
   POST /admin/approve-refund
   - Admin approval for user refund requests
------------------------------------------------------------- */
router.post('/approve-refund', requireAdmin, async (req, res) => {
  try {
    const { paymentId, action, reviewNote } = req.body;
    
    if (!paymentId || !action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    
    const Payment = require('../model/payment');
    const payment = await Payment.findById(paymentId);
    
    if (!payment || !payment.refundRequest || payment.refundRequest.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Invalid refund request' });
    }
    
    if (action === 'approve') {
      // Process refund via PortOne API
      const axios = require('axios');
      const portoneApiSecret = process.env.PORTONE_API_SECRET;
      
      try {
        // Step 1: Get Access Token
        const tokenResponse = await axios.post(
          'https://api.portone.io/login/api-secret',
          {
            api_secret: portoneApiSecret
          }
        );
        
        const accessToken = tokenResponse.data.access_token;
        
        // Step 2: Get payment details from PortOne (verify current status)
        const portonePaymentResponse = await axios.get(
          `https://api.portone.io/payments/${payment.paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        const portonePayment = portonePaymentResponse.data;
        
        // Step 3: Request Refund with cancelable_amount
        await axios.post(
          `https://api.portone.io/payments/${payment.paymentId}/cancel`,
          {
            reason: payment.refundRequest.reason,
            amount: payment.amount,
            cancelable_amount: portonePayment.amount
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Update payment
        payment.status = 'refunded';
        payment.refundedAt = new Date();
        payment.refundAmount = payment.amount;
        payment.refundReason = payment.refundRequest.reason;
        payment.refundRequest.status = 'approved';
        payment.refundRequest.reviewedBy = req.session.user.email;
        payment.refundRequest.reviewedAt = new Date();
        payment.refundRequest.reviewNote = reviewNote || 'Approved by admin';
        
        // Deduct credits/access
        const User = require('../model/user');
        const user = await User.findById(payment.userId);
        
        if (payment.packageType === 'job_ads') {
          user.adsAvailable = Math.max(0, (user.adsAvailable || 0) - (payment.packageDetails.quantity || 0));
        } else if (payment.packageType === 'resume_access') {
          if (user.resumeAccess) user.resumeAccess.isActive = false;
        } else if (payment.packageType === 'tutor_access') {
          if (user.tutorAccess) user.tutorAccess.isActive = false;
        }
        
        await user.save();
        await payment.save();
        
        console.log(`✅ Admin approved refund: ${payment._id}`);
        
        return res.json({ success: true, message: 'Refund approved and processed' });
        
      } catch (apiError) {
        console.error('❌ Refund API error:', {
          message: apiError.message,
          response: apiError.response?.data,
          status: apiError.response?.status,
          paymentId: payment.paymentId
        });
        return res.status(500).json({ 
          success: false, 
          message: `Failed to process refund: ${apiError.response?.data?.message || apiError.message}`,
          error: apiError.response?.data
        });
      }
      
    } else {
      // Reject refund request
      payment.refundRequest.status = 'rejected';
      payment.refundRequest.reviewedBy = req.session.user.email;
      payment.refundRequest.reviewedAt = new Date();
      payment.refundRequest.reviewNote = reviewNote || 'Rejected by admin';
      
      await payment.save();
      
      console.log(`❌ Admin rejected refund: ${payment._id}`);
      
      return res.json({ success: true, message: 'Refund request rejected' });
    }
    
  } catch (err) {
    console.error('❌ Approve refund error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process refund approval' });
  }
});

module.exports = router;
