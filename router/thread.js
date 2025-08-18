// router/thread.js
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Thread = require('../model/thread');

// HTML 뷰: /thread/my
router.get('/my', requireLogin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(5, parseInt(req.query.limit || '20', 10)));

    const query = { userId: String(req.session.user._id || '') };
    const [items, total] = await Promise.all([
      Thread.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Thread.countDocuments(query),
    ]);

    res.render('thread/my', {
      user: req.session.user,
      items,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    console.error('[thread] my view error:', e);
    res.status(500).send('Failed to load activity.');
  }
});

// JSON API: /thread/my.json
router.get('/my.json', requireLogin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(5, parseInt(req.query.limit || '20', 10)));

    const query = { userId: String(req.session.user._id || '') };
    const [items, total] = await Promise.all([
      Thread.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Thread.countDocuments(query),
    ]);

    res.json({
      ok: true,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      items,
    });
  } catch (e) {
    console.error('[thread] my json error:', e);
    res.status(500).json({ ok: false, error: 'thread_list_failed' });
  }
});

module.exports = router;
