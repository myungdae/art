// router/jobSeeker.js
const express = require('express');
const router = express.Router();
const JobSeeker = require('../model/jobSeeker');
const sanitizeHtml = require('sanitize-html');
const { requireLogin } = require('../middleware/auth');
const { MongoClient } = require('mongodb');
const { logThread } = require('../utils/threadLog'); // <-- thread logging

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const FACET_COLL = 'esl';

/* ─────────────────────────────────────────────────────────────
   Facet (esl) sync helpers
   - Upsert/delete an entry in `eventpool.esl` for Job_Seekers
   - We also persist userId/userEmail to enable "my activity" views
   ───────────────────────────────────────────────────────────── */
async function upsertFacetFromSeeker(seeker, sessionUser) {
  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  try {
    const col = client.db(DB_NAME).collection(FACET_COLL);
    const filter = { source: 'job_seekers', sourceId: String(seeker._id) };

    const doc = {
      '@id': `esl:job_seeker:${seeker._id}`,          // unique @id
      '@type': 'Job_Seekers',
      source: 'job_seekers',
      sourceId: String(seeker._id),

      label: seeker.name || 'Untitled',
      title: seeker.jobTitle || seeker.name || 'Untitled',
      description: seeker.description || '',

      hostCountry: seeker.preferredWorkLocation || seeker.nationality || '',
      studentType: undefined,
      teachingArea: seeker.major || '',
      email: seeker.email || '',

      // who did this (for dashboards / activity)
      userId: sessionUser ? String(sessionUser._id) : undefined,
      userEmail: sessionUser ? sessionUser.email : undefined,

      updatedAt: new Date()
    };

    await col.updateOne(filter, { $set: doc }, { upsert: true });
    console.log('[facet] upsert job_seeker → esl:', seeker._id);
  } finally {
    await client.close();
  }
}

async function removeFacetForSeeker(id) {
  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  try {
    await client
      .db(DB_NAME)
      .collection(FACET_COLL)
      .deleteOne({ source: 'job_seekers', sourceId: String(id) });
    console.log('[facet] delete job_seeker in esl:', id);
  } finally {
    await client.close();
  }
}

/* ─────────────────────────────────────────────────────────────
   Pages
   ───────────────────────────────────────────────────────────── */

// internal list (login required)
router.get('/', requireLogin, async (req, res) => {
  try {
    const seekers = await JobSeeker.find().sort({ createdAt: -1 });
    res.render('jobSeeker/index', { seekers });
  } catch (err) {
    console.error('❌ Error fetching job seekers:', err.message);
    res.status(500).send('❌ Error fetching job seekers');
  }
});

// new form
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

// create
router.post('/', requireLogin, async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      jobTitle: sanitizeHtml(req.body.jobTitle || ''),
      description: sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} }),
      email: req.body.email || (req.session.user && req.session.user.email) || '', // fallback to logged-in email
      nationality: req.body.nationality || req.body.customNationality,
      preferredWorkLocation: req.body.preferredWorkLocation || req.body.customPreferredWorkLocation,
      major: req.body.major || req.body.customMajor,
      languageSpoken: req.body.languageSpoken,
      educationBackground: req.body.educationBackground,
      availableFrom: req.body.availableFrom
    };

    const newSeeker = await new JobSeeker(data).save();

    // facet sync
    await upsertFacetFromSeeker(newSeeker, req.session.user);

    // activity log
    await logThread(req, {
      type: 'crud',
      action: 'create',
      source: 'job_seekers',
      sourceId: String(newSeeker._id),
      title: `Create Job Seeker: ${newSeeker.name || newSeeker.jobTitle || ''}`,
      summary: `email=${newSeeker.email || ''}`
    });

    res.redirect('/facet/Job_Seekers');
  } catch (err) {
    console.error('❌ Error saving job seeker:', err.message);
    res.status(500).send('❌ Error saving job seeker');
  }
});

// edit form
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

// update
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const seeker = await JobSeeker.findById(req.params.id);
    if (!seeker) return res.status(404).send('❌ Job Seeker not found');

    seeker.name = req.body.name;
    seeker.jobTitle = sanitizeHtml(req.body.jobTitle || '');
    seeker.description = sanitizeHtml(req.body.description || '', { allowedTags: [], allowedAttributes: {} });
    seeker.email = req.body.email || seeker.email || (req.session.user && req.session.user.email) || '';
    seeker.nationality = req.body.nationality || req.body.customNationality;
    seeker.preferredWorkLocation = req.body.preferredWorkLocation || req.body.customPreferredWorkLocation;
    seeker.major = req.body.major || req.body.customMajor;
    seeker.languageSpoken = req.body.languageSpoken;
    seeker.educationBackground = req.body.educationBackground;
    seeker.availableFrom = req.body.availableFrom;

    await seeker.save();

    // facet sync
    await upsertFacetFromSeeker(seeker, req.session.user);

    // activity log
    await logThread(req, {
      type: 'crud',
      action: 'update',
      source: 'job_seekers',
      sourceId: String(seeker._id),
      title: `Update Job Seeker: ${seeker.name || seeker.jobTitle || ''}`,
      summary: `email=${seeker.email || ''}`
    });

    res.redirect('/facet/Job_Seekers');
  } catch (err) {
    console.error('❌ Error updating job seeker:', err.message);
    res.status(500).send('❌ Error updating job seeker');
  }
});

// delete
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const id = req.params.id;
    const seeker = await JobSeeker.findById(id).lean();

    await JobSeeker.findByIdAndDelete(id);
    await removeFacetForSeeker(id);

    // activity log
    await logThread(req, {
      type: 'crud',
      action: 'delete',
      source: 'job_seekers',
      sourceId: String(id),
      title: `Delete Job Seeker`,
      summary: `email=${(seeker && seeker.email) || ''}`
    });

    res.redirect('/facet/Job_Seekers');
  } catch (err) {
    console.error('❌ Error deleting job seeker:', err.message);
    res.status(500).send('❌ Error deleting job seeker');
  }
});

module.exports = router;
