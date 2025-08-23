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

/** ---------- helpers: robust pipelines ---------- */
function pipelineFromFieldCandidates(candidates) {
  // candidates: ['country', 'countryLabel', ...]
  const coalesced =
    candidates.slice(1).reduceRight((acc, f) => ({ $ifNull: [ `$${candidates[0]}`, acc ] }),
      `$${candidates[0]}`
    );
  // 위 reduceRight는 첫 번째만 쓰게 되므로 아래처럼 명시적으로 체인 구성
  let chain = null;
  for (let i = candidates.length - 1; i >= 0; i--) {
    chain = chain ? { $ifNull: [ `$${candidates[i]}`, chain ] } : `$${candidates[i]}`;
  }

  return [
    { $project: { raw: chain ?? null } },
    {
      $set: {
        arr: {
          $cond: [
            { $eq: [ { $type: '$raw' }, 'array' ] }, '$raw',
            {
              $cond: [
                { $eq: [ { $type: '$raw' }, 'object' ] },
                [
                  {
                    $ifNull: [
                      '$raw.name',
                      { $ifNull: [ '$raw.label', { $ifNull: [ '$raw.code', null ] } ] }
                    ]
                  }
                ],
                {
                  $cond: [
                    { $eq: [ { $type: '$raw' }, 'string' ] },
                    [ '$raw' ],
                    []
                  ]
                }
              ]
            }
          ]
        }
      }
    },
    { $unwind: '$arr' },
    {
      $set: {
        val: {
          $switch: {
            branches: [
              {
                case: { $eq: [ { $type: '$arr' }, 'object' ] },
                then: { $ifNull: [ '$arr.name', { $ifNull: [ '$arr.label', { $ifNull: [ '$arr.code', null ] } ] } ] }
              },
              { case: { $eq: [ { $type: '$arr' }, 'string' ] }, then: '$arr' }
            ],
            default: null
          }
        }
      }
    },
    { $set: { val: { $trim: { input: '$val' } } } },
    { $match: { val: { $nin: [ null, '' ] } } },
    { $group: { _id: '$val', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 12 }
  ];
}

const countryCandidates = ['country', 'countryLabel', 'country_name', 'countryCode'];
const studentCandidates = ['studentType', 'studentTypes', 'student_type', 'students', 'studentCategory'];
const areaCandidates    = ['teachingArea', 'teachingAreas', 'subjectArea', 'subjectAreas', 'subject', 'subjects'];

/** ---------- Home ---------- */
router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;

    // Totals from canonical *_RDF
    const [vCount, sCount, tCount] = await Promise.all([
      db.collection(`${VAC}_RDF`).countDocuments({}),
      db.collection(`${SEEK}_RDF`).countDocuments({}),
      db.collection(`${TUTOR}_RDF`).countDocuments({})
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
        .limit(6).toArray()
    ]);

    // Chips (robust)
    const [topCountries, topStudents, topAreas] = await Promise.all([
      db.collection(`${VAC}_RDF`).aggregate(pipelineFromFieldCandidates(countryCandidates)).toArray(),
      db.collection(`${VAC}_RDF`).aggregate(pipelineFromFieldCandidates(studentCandidates)).toArray(),
      db.collection(`${VAC}_RDF`).aggregate(pipelineFromFieldCandidates(areaCandidates)).toArray()
    ]);

    console.log('[HOME/CHIPS]', {
      countries: topCountries.length,
      students : topStudents.length,
      areas    : topAreas.length
    });

    res.render('home', {
      stats: { vCount, sCount, tCount },

      recentVacancies: recentVacancies.map(d => ({
        id: d._id.toString(),
        title: pickTitle(d),
        country: d.country || '',
        studentType: d.studentType || '',
        teachingAreas: Array.isArray(d.teachingArea) ? d.teachingArea : (d.teachingArea ? [d.teachingArea] : []),
        date: d.datePosted ? new Date(d.datePosted) : null
      })),

      recentSeekers: recentSeekers.map(d => ({
        id: d._id.toString(),
        title: pickTitle(d),
        country: d.country || '',
        languages: Array.isArray(d.languages) ? d.languages : (d.languages ? [d.languages] : []),
        date: d.datePosted ? new Date(d.datePosted) : null
      })),

      recentTutors: recentTutors.map(d => ({
        id: d._id.toString(),
        title: pickTitle(d),
        country: d.country || '',
        languages: Array.isArray(d.languages) ? d.languages : (d.languages ? [d.languages] : []),
        date: d.datePosted ? new Date(d.datePosted) : null
      })),

      topCountries,
      topStudents,
      topAreas
    });
  } catch (err) {
    console.error('GET / (home) error:', err);
    next(err);
  }
});

/** Search bar redirect helper */
router.get('/go', (req, res) => {
  const facet = (req.query.facet || '').trim();
  const q = (req.query.q || '').trim();
  if (!facet) return res.redirect('/');
  const base = `/facet/${encodeURIComponent(facet)}`;
  const url = q ? `${base}?q=${encodeURIComponent(q)}` : base;
  return res.redirect(url);
});

/** Lightweight stats API for the counters */
router.get('/api/home/stats', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const [vCount, sCount, tCount] = await Promise.all([
      db.collection(`${VAC}_RDF`).countDocuments({}),
      db.collection(`${SEEK}_RDF`).countDocuments({}),
      db.collection(`${TUTOR}_RDF`).countDocuments({})
    ]);
    res.json({ vCount, sCount, tCount });
  } catch (e) {
    res.status(500).json({ vCount: 0, sCount: 0, tCount: 0 });
  }
});

/** (Optional) debug endpoint to see what chips would render */
router.get('/api/home/debug/chips', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const [topCountries, topStudents, topAreas] = await Promise.all([
      db.collection(`${VAC}_RDF`).aggregate(pipelineFromFieldCandidates(countryCandidates)).toArray(),
      db.collection(`${VAC}_RDF`).aggregate(pipelineFromFieldCandidates(studentCandidates)).toArray(),
      db.collection(`${VAC}_RDF`).aggregate(pipelineFromFieldCandidates(areaCandidates)).toArray()
    ]);
    res.json({ topCountries, topStudents, topAreas });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

module.exports = router;
