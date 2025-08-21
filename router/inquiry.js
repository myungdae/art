// router/inquiry.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Inquiry = require('../model/inquiry');
const mailer = require('../utils/mailer');

// ───────────────────────────────────────
// Validation (English only)
// ───────────────────────────────────────
function validate(body) {
  const errors = {};
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const subject = (body.subject || '').trim();
  const message = (body.message || '').trim();

  if (name.length < 2) errors.name = 'Please enter at least 2 characters.';
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) errors.email = 'Please enter a valid email address.';
  if (subject.length < 2) errors.subject = 'Please enter a subject (min 2 chars).';
  if (message.length < 10) errors.message = 'Please enter at least 10 characters.';

  return errors;
}

// ───────────────────────────────────────
// Simple cooldown (60s per session for POST /inquiry)
// ───────────────────────────────────────
function throttleInquiry(req, res, next) {
  const now = Date.now();
  const last = req.session?.lastInquiryAt || 0;
  if (now - last < 60 * 1000) {
    return res.status(429).render('inquiry/form', {
      values: req.body || {},
      errors: { _global: 'Please wait a moment before sending again.' },
    });
  }
  req.session.lastInquiryAt = now;
  next();
}

// ───────────────────────────────────────
// GET inquiry form
// ───────────────────────────────────────
router.get('/inquiry', (req, res) => {
  return res.render('inquiry/form', {
    values: {
      name: req.session?.user?.name || '',
      email: req.session?.user?.email || '',
      subject: '',
      message: '',
    },
    errors: {},
  });
});

// ───────────────────────────────────────
// POST inquiry
// ───────────────────────────────────────
router.post('/inquiry', throttleInquiry, async (req, res) => {
  try {
    const { name = '', email = '', subject = '', message = '' } = req.body || {};
    const values = { name, email, subject, message };

    // validate
    const errors = validate(values);
    if (Object.keys(errors).length) {
      return res.status(422).render('inquiry/form', { values, errors });
    }

    // persist
    const doc = await Inquiry.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      userId:
        req.session?.user?._id && mongoose.isValidObjectId(req.session.user._id)
          ? req.session.user._id
          : null,
      userAgent: req.headers['user-agent'] || '',
      ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString(),
      createdAt: new Date(),
    });

    // mail subjects/prefix
    const PREFIX = process.env.MAIL_SUBJECT_PREFIX || '[ESL]';
    const SERVICE = process.env.SERVICE_NAME || 'ESL';
    const adminTo = process.env.INQUIRY_TO;

    // admin mail
    if (adminTo && process.env.SMTP_USER && mailer.DEFAULT_FROM) {
      const textAdmin =
        `New inquiry received.\n\n` +
        `From : ${name} <${email}>\n` +
        `Subject : ${subject}\n\n` +
        `${message}\n\n` +
        `Doc ID : ${doc._id}\n` +
        `IP     : ${(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()}\n` +
        `UA     : ${req.headers['user-agent'] || ''}\n`;

      await mailer.send({
        to: adminTo,
        subject: `${PREFIX} New Inquiry - ${subject}`,
        text: textAdmin,
        html: textAdmin.replace(/\n/g, '<br>'),
        // 👉 Reply-To so admin can reply directly to the user
        replyTo: email.trim(),
      });
      console.log(`📬 Inquiry mail sent to admin: ${adminTo}`);
    } else {
      console.warn('⚠️ Skipped admin mail: INQUIRY_TO/SMTP_USER or SMTP_FROM not set.');
    }

    // auto-reply to user
    try {
      const textUser =
        `Hello ${name.split(' ')[0] || 'there'},\n\n` +
        `Thanks for your inquiry. We have received your message and will get back to you shortly.\n\n` +
        `Subject: ${subject}\n` +
        `Message:\n${message}\n\n` +
        `Reference: ${doc._id}\n` +
        `— ${SERVICE} Support`;
      await mailer.send({
        to: email,
        subject: `Thanks for your inquiry — ${SERVICE}`,
        text: textUser,
        html: textUser.replace(/\n/g, '<br>'),
      });
      console.log(`📬 Auto-reply mail sent to: ${email}`);
    } catch (e) {
      console.error(`❌ Auto-reply failed: ${e.message}`);
    }

    return res.redirect('/inquiry/sent');
  } catch (e) {
    console.error('[Inquiry][POST] error:', e);
    return res.status(500).render('inquiry/form', {
      values: req.body || {},
      errors: { _global: 'An error occurred while sending. Please try again later.' },
    });
  }
});

// ───────────────────────────────────────
// Sent page
// ───────────────────────────────────────
router.get('/inquiry/sent', (req, res) => {
  return res.render('inquiry/sent');
});

module.exports = router;
