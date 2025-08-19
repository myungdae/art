// router/facet.js
'use strict';

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl';

// URL :type → 문서 "@type" 매핑
const TYPE_ALIASES = {
  Job_Vacancies: ['Job_Vacancies', 'JobVacancies', 'sch:JobPosting'],
  Job_Seekers:   ['Job_Seekers',   'JobSeekers',   'sch:Person'],
  Online_Tutors: ['Online_Tutors', 'OnlineTutors', 'sch:Person'],
};

// 화면 타이틀
const TITLE_BY_TYPE = {
  Job_Vacancies: 'Job Vacancies',
  Job_Seekers:   'Job Seekers',
  Online_Tutors: 'Online Tutors',
};

// 정규식 폴백용 검색 필드
const SEARCH_FIELDS = {
  Job_Vacancies: ['title', 'position', 'description', 'label', 'organization', 'department', '_label', '_description', 'companyName', 'jobLocation', 'hostCountry', 'country', 'teachingArea', 'studentType', 'email'],
  Job_Seekers:   ['title', 'label', 'description', '_label', '_description', 'hostCountry', 'teachingArea', 'email'],
  Online_Tutors: ['title', 'label', 'description', '_label', '_description', 'teachingArea', 'email'],
};

function escapeRegex(s = '') { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function buildRegexOr(q, fields) {
  const re = escapeRegex(q);
  const ors = (fields || []).map(f => ({ [f]: { $regex: re, $options: 'i' } }));
  return ors.length ? { $or: ors } : {};
}

async function hasAnyTextIndex(col) {
  try {
    const idx = await col.indexes();
    return Array.isArray(idx) && idx.some(x => x.key && Object.values(x.key).includes('text'));
  } catch {
    return false;
  }
}

router.get('/:type', async (req, res) => {
  const facetType = req.params.type; // Job_Vacancies | Job_Seekers | Online_Tutors

  // 허용 타입 검증
  const allowedTypes = Object.keys(TYPE_ALIASES);
  if (!allowedTypes.includes(facetType)) {
    return res.status(404).send('Unknown facet type');
  }

  const qRaw   = (req.query.q || req.query.keyword || '').trim();
  const q      = qRaw.length ? qRaw : '';
  const page   = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip   = (page - 1) * limit;

  // 공통 필터 (좌측 패싯과 연동)
  const baseFilters = {};
  ['hostCountry', 'studentType', 'teachingArea'].forEach(k => {
    const v = (req.query[k] || '').trim();
    if (v) baseFilters[k] = v;
  });

  let client;
  try {
    client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
    await client.connect();

    const db  = client.db(DB_NAME);
    const col = db.collection(COLLECTION_NAME);

    // 1) @type 매핑
    const typeList  = TYPE_ALIASES[facetType] || [facetType];
    const baseMatch = { '@type': { $in: typeList }, ...baseFilters };

    // 2) q 검색 ($text 우선, 없으면 정규식)
    let searchMatch = {};
    if (q) {
      if (await hasAnyTextIndex(col)) {
        searchMatch = { $text: { $search: q } };
      } else {
        searchMatch = buildRegexOr(q, SEARCH_FIELDS[facetType] || []);
      }
    }

    const hasSearch = Object.keys(searchMatch).length > 0;
    const finalMatch = hasSearch ? { $and: [baseMatch, searchMatch] } : baseMatch;

    // 3) 정렬/프로젝션
    let sort = { updatedAt: -1, createdAt: -1, _id: -1 };
    let projection = {};
    // $text 검색인 경우 점수 정렬
    if (q && searchMatch.$text) {
      projection = { score: { $meta: 'textScore' } };
      sort = { score: { $meta: 'textScore' } };
    }

    // 4) 데이터 + 총건수
    const cursor = col.find(finalMatch, { projection }).sort(sort).skip(skip).limit(limit);
    const data   = await cursor.toArray();
    const total  = await col.countDocuments(finalMatch);

    // 5) facet 집계(같은 match)
    const agg = await col.aggregate([
      { $match: finalMatch },
      {
        $facet: {
          hostCountry:  [{ $group: { _id: '$hostCountry',  count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
          studentType:  [{ $group: { _id: '$studentType',  count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
          teachingArea: [{ $group: { _id: '$teachingArea', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
        }
      }
    ]).toArray();

    const facets = (agg && agg[0]) ? agg[0] : { hostCountry: [], studentType: [], teachingArea: [] };

    // (디버깅) 헤더
    res.set('X-Facet-Type', facetType);
    res.set('X-Facet-Total', String(total));
    res.set('X-Facet-View', 'facet-esl');

    // 좌측 패싯 UI 데이터 만들기
    const filtersUi = [
      {
        name: 'hostCountry', display: 'Host Country',
        options: (facets.hostCountry || []).map(f => ({
          label: f._id || 'N/A',
          value: f._id || '',
          count: f.count,
          selected: baseFilters.hostCountry === (f._id || ''),
        }))
      },
      {
        name: 'studentType', display: 'Student Type',
        options: (facets.studentType || []).map(f => ({
          label: f._id || 'N/A',
          value: f._id || '',
          count: f.count,
          selected: baseFilters.studentType === (f._id || ''),
        }))
      },
      {
        name: 'teachingArea', display: 'Teaching Area',
        options: (facets.teachingArea || []).map(f => ({
          label: f._id || 'N/A',
          value: f._id || '',
          count: f.count,
          selected: baseFilters.teachingArea === (f._id || ''),
        }))
      },
    ];

    return res.render('facet', {
      title: TITLE_BY_TYPE[facetType] || facetType.replace(/_/g, ' '),
      data,
      total,
      page,
      limit,
      q,
      activeType: facetType,
      filters: filtersUi,
    });
  } catch (e) {
    console.error('[facet] error:', e);

    res.set('X-Facet-Type', req.params.type || '');
    res.set('X-Facet-Total', '0');
    res.set('X-Facet-View', 'facet-esl');

    return res.render('facet', {
      title: TITLE_BY_TYPE[req.params.type] || (req.params.type || '').replace(/_/g, ' '),
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      q: (req.query.q || req.query.keyword || '').trim(),
      activeType: req.params.type,
      filters: [
        { name: 'hostCountry',  display: 'Host Country',  options: [] },
        { name: 'studentType',  display: 'Student Type',  options: [] },
        { name: 'teachingArea', display: 'Teaching Area', options: [] },
      ],
    });
  } finally {
    try { if (client) await client.close(); } catch (_) { /* noop */ }
  }
});

module.exports = router;
