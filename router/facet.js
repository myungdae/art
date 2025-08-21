// router/facet.js
'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// ---- 유틸 ----
const toArray = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
const sanitizeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 클래스별 후보 컬렉션 (앞에 있을수록 우선)
const COLL_MAP = {
  Job_Vacancies: ['Job_Vacancies_RDF', 'Job_Vacancies', 'jobvacancies'],
  Job_Seekers:   ['Job_Seekers_RDF',   'Job_Seekers',   'jobseekers', 'job_seekers'],
  Online_Tutors: ['Online_Tutors_RDF', 'Online_Tutors', 'online_tutors', 'onlinetutors'],
};

async function pickExistingCollection(db, candidates) {
  for (const name of (candidates || [])) {
    const meta = await db.listCollections({ name }).toArray();
    if (meta.length) {
      const cnt = await db.collection(name).estimatedDocumentCount();
      if (cnt > 0) return name;
    }
  }
  return null;
}

// 공통 정규화 + 검색/필터 스테이지
function facetStages({ q, selected, enforceClass }) {
  const match = {};
  if (enforceClass) match._class = enforceClass;

  if (q && q.trim()) {
    const rx = new RegExp(sanitizeRegex(q.trim()), 'i');
    match.$or = [
      { _label: rx },
      { title: rx },
      { _description: rx },
      { description: rx },
    ];
  }
  if (selected?.country?.length)     match.country = { $in: selected.country };
  if (selected?.studentType?.length) match.studentType = { $in: selected.studentType };
  if (selected?.teachingArea?.length) match.teachingArea = { $in: selected.teachingArea };

  return [
    // 필드 정규화
    { $addFields: {
        country:     { $ifNull: ['$country', ''] },
        studentType: { $ifNull: ['$studentType', ''] },
        teachingArea: {
          $cond: [
            { $eq: [ { $type: '$teachingArea' }, 'array' ] }, '$teachingArea',
            {
              $cond: [
                { $eq: [ { $type: '$teachingArea' }, 'string' ] },
                { $let: {
                    vars: { parts: { $split: ['$teachingArea', ','] } },
                    in: {
                      $filter: {
                        input: { $map: { input: '$$parts', as: 's', in: { $trim: { input: '$$s' } } } },
                        as: 'x', cond: { $ne: ['$$x', ''] }
                      }
                    }
                  }},
                []
              ]
            }
          ]
        },
        title:        { $ifNull: ['$title', ''] },
        _label:       { $ifNull: ['$_label', ''] },
        description:  { $ifNull: ['$description', ''] },
        _description: { $ifNull: ['$_description', ''] },
        datePosted:   { $ifNull: ['$datePosted', '$createdAt'] },
        updatedAt:    { $ifNull: ['$updatedAt', '$$NOW'] },
      }
    },
    ...(Object.keys(match).length ? [{ $match: match }] : []),
  ];
}

// ---- 라우트 ----
router.get('/:klass', async (req, res, next) => {
  try {
    const klass = req.params.klass;
    const db = mongoose.connection.db;

    // ✅ 공고는 RDF 컬렉션을 강제로 사용 (안정)
    let collectionName = (klass === 'Job_Vacancies')
      ? 'Job_Vacancies_RDF'
      : await pickExistingCollection(db, COLL_MAP[klass] || [klass]);

    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10), 100));
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const skip  = (page - 1) * limit;

    const selected = {
      country:      toArray(req.query.country),
      studentType:  toArray(req.query.studentType),
      teachingArea: toArray(req.query.teachingArea),
    };
    const q = (req.query.q || '').trim();

    let docs = [];
    let total = 0;
    let facets = { country: [], studentType: [], teachingArea: [] };

    if (collectionName) {
      const coll = db.collection(collectionName);

      // RDF 계열이면 _class=klass 필터 강제, 비-RDF면 생략
      const enforceClass = collectionName.endsWith('_RDF') ? klass : null;

      // 총 개수
      const cnt = await coll.aggregate([
        ...facetStages({ q, selected, enforceClass }),
        { $count: 'c' }
      ]).toArray();
      total = cnt.length ? cnt[0].c : 0;

      // 리스트
      docs = await coll.aggregate([
        ...facetStages({ q, selected, enforceClass }),
        { $sort: { datePosted: -1, updatedAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: {
            _id: 1,
            '@id': 1,
            _label: 1,
            _description: 1,
            title: 1,
            country: 1,
            studentType: 1,
            teachingArea: 1,
            datePosted: 1,
            updatedAt: 1
        }}
      ]).toArray();

      // 패싯
      const fac = await coll.aggregate([
        ...facetStages({ q, selected, enforceClass }),
        {
          $facet: {
            country:     [{ $group: { _id: '$country',     c: { $sum: 1 } } }, { $sort: { c: -1, _id: 1 } }],
            studentType: [{ $group: { _id: '$studentType', c: { $sum: 1 } } }, { $sort: { c: -1, _id: 1 } }],
            teachingArea:[
              { $unwind: { path: '$teachingArea', preserveNullAndEmptyArrays: false } },
              { $group: { _id: '$teachingArea', c: { $sum: 1 } } },
              { $sort: { c: -1, _id: 1 } },
              { $limit: 200 }
            ],
          }
        }
      ]).toArray();
      if (fac.length) facets = fac[0];
      // null/빈값 제거
      facets.country      = (facets.country || []).filter(x => x && x._id);
      facets.studentType  = (facets.studentType || []).filter(x => x && x._id);
      facets.teachingArea = (facets.teachingArea || []).filter(x => x && x._id);
    }

    res.render('facet/list', {
      klass,
      docs,
      total,
      page,
      limit,
      q,
      selected,
      facets
    });
  } catch (e) {
    console.error('[FACET] error:', e);
    next(e);
  }
});

module.exports = router;
