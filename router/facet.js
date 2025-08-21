// router/facet.js
'use strict';

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// helpers
const toArray = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
const sanitizeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ✅ 클래스별 패싯 설정
//   - key: 컬렉션 필드명
//   - label: 좌측 패싯 제목
//   - array: 배열 필드라면 true (unwind 필요)
const FACET_MAP = {
  Job_Vacancies: {
    groups: [
      { key: 'country',      label: 'Country' },
      { key: 'studentType',  label: 'Student Type' },
      { key: 'teachingArea', label: 'Teaching Area', array: true },
    ],
    searchFields: ['_label', 'title', '_description'],
    coll: (klass) => `${klass}_RDF`,
  },
  Job_Seekers: {
    groups: [
      { key: 'Nationality',             label: 'Nationality' },
      { key: 'Preferred_Work_Location', label: 'Preferred Work Location' },
      { key: 'Major',                   label: 'Major' },
    ],
    searchFields: ['_label', 'title', '_description'],
    coll: (klass) => `${klass}_RDF`,
  },
  Online_Tutors: {
    groups: [
      { key: 'Expertise',            label: 'Expertise', array: true },
      { key: 'Tutoring_Experience',  label: 'Tutoring Experience' },
      { key: 'Gender',               label: 'Gender' },
    ],
    searchFields: ['_label', 'title', '_description'],
    coll: (klass) => `${klass}_RDF`,
  },
};

router.get('/:klass', async (req, res, next) => {
  try {
    const klass = req.params.klass;               // ex) "Job_Vacancies"
    const spec  = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const coll  = spec.coll ? spec.coll(klass) : `${klass}_RDF`;

    const db = mongoose.connection.db;

    // 선택된 필터 파싱 (클래스별 key 사용)
    const selected = {};
    for (const g of spec.groups) {
      selected[g.key] = toArray(req.query[g.key]);
    }

    const qText = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 5000);
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const skip  = (page - 1) * limit;

    // 매치
    const match = { _class: klass };
    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), 'i');
      match.$or = (spec.searchFields || ['_label','title','_description']).map(f => ({ [f]: rx }));
    }
    // 필터 반영
    for (const g of spec.groups) {
      if (selected[g.key] && selected[g.key].length) {
        match[g.key] = { $in: selected[g.key] };
      }
    }

    // 동적 facet 빌드
    const facetStages = {
      items: [
        { $sort: { datePosted: -1, updatedAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: Object.fromEntries([
            ['_id', 1],
            ['@id', 1],
            ['_label', 1],
            ['_description', 1],
            ['title', 1],
            ['datePosted', 1],
            ['updatedAt', 1],
            // 결과 카드에 쓸 수 있도록 모든 facet key도 project
            ...spec.groups.map(g => [g.key, 1]),
          ])
        }
      ],
      count: [{ $count: 'total' }]
    };

    // 그룹별 카운트 서브파이프라인
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const arr = [];
      if (g.array) {
        arr.push({ $unwind: { path: `$${g.key}`, preserveNullAndEmptyArrays: false } });
      }
      arr.push(
        { $match: { [g.key]: { $ne: null, $ne: '' } } },
        { $group: { _id: `$${g.key}`, c: { $sum: 1 } } },
        { $sort: { c: -1, _id: 1 } },
        { $limit: 400 }
      );
      facetStages[name] = arr;
    }

    const pipeline = [
      { $match: match },
      { $facet: facetStages }
    ];

    const [agg] = await db.collection(coll).aggregate(pipeline).toArray();
    const docs   = (agg && agg.items) || [];
    const total  = (agg && agg.count && agg.count[0] && agg.count[0].total) || 0;

    // 템플릿으로 넘길 facets: { [key]: [{_id, c}, ...] }
    const facets = {};
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      facets[g.key] = ((agg && agg[name]) || []).filter(x => x._id);
    }

    res.render('facet/list', {
      klass,
      docs,
      total,
      page,
      limit,
      q: qText,
      selected,
      facets,
      facetCfg: { groups: spec.groups }  // 👈 Pug에서 어떤 그룹을 그릴지 알 수 있게 전달
    });
  } catch (e) {
    console.error('[FACET] error:', e);
    next(e);
  }
});

module.exports = router;
