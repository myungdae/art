// router/home.js
'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const VAC   = 'Job_Vacancies';
const SEEK  = 'Job_Seekers';
const TUTOR = 'Online_Tutors';

function pickTitle(d) {
  return (d?._label || d?.title || d?.name || '').toString();
}

/**
 * 홈 화면
 */
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;

    // Totals from canonical *_RDF
    const [vCount, sCount, tCount] = await Promise.all([
      db.collection(`${VAC}_RDF`).countDocuments({}),
      db.collection(`${SEEK}_RDF`).countDocuments({}),
      db.collection(`${TUTOR}_RDF`).countDocuments({}),
    ]);

    // Recents
    const [recentVacancies, recentSeekers, recentTutors] = await Promise.all([
      db.collection(`${VAC}_RDF`)
        .find({}, { projection: { _label: 1, title: 1, country: 1, studentType: 1, teachingArea: 1, datePosted: 1, updatedAt: 1, createdAt: 1 } })
        .sort({ datePosted: -1, updatedAt: -1, createdAt: -1 })
        .limit(6).toArray(),
      db.collection(`${SEEK}_RDF`)
        .find({}, { projection: { _label: 1, title: 1, name: 1, country: 1, languages: 1, datePosted: 1, updatedAt: 1, createdAt: 1 } })
        .sort({ datePosted: -1, updatedAt: -1, createdAt: -1 })
        .limit(6).toArray(),
      db.collection(`${TUTOR}_RDF`)
        .find({}, { projection: { _label: 1, title: 1, name: 1, country: 1, languages: 1, datePosted: 1, updatedAt: 1, createdAt: 1 } })
        .sort({ datePosted: -1, updatedAt: -1, createdAt: -1 })
        .limit(6).toArray(),
    ]);

    // Top Countries (chips)
    const topCountries = await db.collection(`${VAC}_RDF`).aggregate([
      { $match: { country: { $nin: [null, ''] } } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]).toArray();

    // Top Student Types (handle string or array)
    const topStudents = await db.collection(`${VAC}_RDF`).aggregate([
      { $project: { studentType: 1 } },
      {
        $set: {
          arr: {
            $cond: [
              { $isArray: '$studentType' }, '$studentType',
              {
                $cond: [
                  { $or: [{ $eq: ['$studentType', null] }, { $eq: ['$studentType', ''] }] },
                  [],
                  ['$studentType'],
                ],
              },
            ],
          },
        },
      },
      { $unwind: '$arr' },
      { $match: { arr: { $nin: [null, ''] } } },
      { $group: { _id: '$arr', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]).toArray();

    // Top Teaching Areas (handle string or array)
    const topAreas = await db.collection(`${VAC}_RDF`).aggregate([
      { $project: { teachingArea: 1 } },
      {
        $set: {
          arr: {
            $cond: [
              { $isArray: '$teachingArea' }, '$teachingArea',
              {
                $cond: [
                  { $or: [{ $eq: ['$teachingArea', null] }, { $eq: ['$teachingArea', ''] }] },
                  [],
                  ['$teachingArea'],
                ],
              },
            ],
          },
        },
      },
      { $unwind: '$arr' },
      { $match: { arr: { $nin: [null, ''] } } },
      { $group: { _id: '$arr', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]).toArray();

    res.render('home', {
      stats: { vCount, sCount, tCount },

      recentVacancies: recentVacancies.map(d => ({
        id: d._id.toString(),
        title: pickTitle(d),
        country: d.country || '',
        studentType: d.studentType || '',
        teachingAreas: Array.isArray(d.teachingArea) ? d.teachingArea : (d.teachingArea ? [d.teachingArea] : []),
        date: d.datePosted ? new Date(d.datePosted) : null,
      })),

      recentSeekers: recentSeekers.map(d => ({
        id: d._id.toString(),
        title: pickTitle(d),
        country: d.country || '',
        languages: Array.isArray(d.languages) ? d.languages : (d.languages ? [d.languages] : []),
        date: d.datePosted ? new Date(d.datePosted) : null,
      })),

      recentTutors: recentTutors.map(d => ({
        id: d._id.toString(),
        title: pickTitle(d),
        country: d.country || '',
        languages: Array.isArray(d.languages) ? d.languages : (d.languages ? [d.languages] : []),
        date: d.datePosted ? new Date(d.datePosted) : null,
      })),

      topCountries,
      topStudents,
      topAreas,
    });
  } catch (err) {
    console.error('GET / (home) error:', err);
    next(err);
  }
});

/**
 * Search bar redirect helper
 */
router.get('/go', (req, res) => {
  const facet = (req.query.facet || '').trim();
  const q = (req.query.q || '').trim();
  if (!facet) return res.redirect('/');
  const base = `/facet/${encodeURIComponent(facet)}`;
  const url = q ? `${base}?q=${encodeURIComponent(q)}` : base;
  return res.redirect(url);
});

/**
 * Lightweight stats API for the counters
 */
router.get('/api/home/stats', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const [vCount, sCount, tCount] = await Promise.all([
      db.collection(`${VAC}_RDF`).countDocuments({}),
      db.collection(`${SEEK}_RDF`).countDocuments({}),
      db.collection(`${TUTOR}_RDF`).countDocuments({}),
    ]);
    res.json({ vCount, sCount, tCount });
  } catch (e) {
    res.status(500).json({ vCount: 0, sCount: 0, tCount: 0 });
  }
});

module.exports = router;
