const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';  // ✅ 리소스 base URI

// RDF Key Constants
const LABEL_KEYS = [
  'http://www[dot]w3[dot]org/2000/01/rdf-schema#label',
  'rdfs:label',
  'label',
  'title'
];

const DESCRIPTION_KEYS = [
  'http://purl[dot]org/dc/elements/1[dot]1/description',
  'description'
];

const TYPE = '@type';
const ID = '@id';

// ✅ Helper: 안전하게 label 또는 description 추출
function getFirstAvailableValue(doc, keys, fallback = '') {
  for (const key of keys) {
    const value = doc[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value['@value']) return value['@value'];
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && first['@value']) return first['@value'];
    }
  }
  return fallback;
}

// ✅ 복수형 facetType → 단수형 type 변환
function normalizeFacetType(facetType) {
  return facetType
    .replace(/ies$/i, 'y')       // Vacancies → Vacancy
    .replace(/s$/i, '');         // Tutors → Tutor
}

// ✅ 기본 목록 + 필터링 지원 (e.g., /facet/country?filter=studentType:Middle)
router.get('/:type', async (req, res) => {
  const facetTypeRaw = req.params.type;
  const normalizedType = normalizeFacetType(facetTypeRaw);
  const filter = req.query.filter;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  let filterQuery = {};
  let filter_item = [];

  if (filter) {
    const filters = Array.isArray(filter) ? filter : [filter];
    filters.forEach(f => {
      const [title, value] = f.split(':');
      if (!filterQuery[title]) filterQuery[title] = { $in: [] };
      filterQuery[title].$in.push(value);
      filter_item.push({
        title,
        value,
        encoded: encodeURIComponent(`${title}:${value}`)
      });
    });
  }

  const rawDocs = await col.find({
    [TYPE]: { $regex: normalizedType, $options: 'i' },
    ...filterQuery
  }).toArray();

  const docs = rawDocs.map(doc => ({
    _id: doc[ID] || '',
    _type: doc[TYPE] || '',
    _label: getFirstAvailableValue(doc, LABEL_KEYS, 'No Title'),
    _description: getFirstAvailableValue(doc, DESCRIPTION_KEYS, 'No description.')
  }));

  const facetList = [];
  const facetFields = ['country', 'studentType', 'teachingArea'];

  for (const field of facetFields) {
    const pipeline = [
      { $match: { [TYPE]: { $regex: normalizedType, $options: 'i' } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const values = await col.aggregate(pipeline).toArray();
    facetList.push({
      _id: field,
      values: values.map(v => ({ val: v._id, count: v.count }))
    });
  }

  res.render('facet', {
    facetType: facetTypeRaw,
    docs,
    facetList,
    filter_item,
    baseURI: BASE   // ✅ View 링크 생성을 위한 BASE 전달
  });
});

// ✅ 개별 값 필터링 (e.g., /facet/country/South Korea)
router.get('/:type/:value', async (req, res) => {
  const facetTypeRaw = req.params.type;
  const facetValue = decodeURIComponent(req.params.value);
  const normalizedType = normalizeFacetType(facetTypeRaw);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  const query = {
    [TYPE]: { $regex: normalizedType, $options: 'i' },
    [facetTypeRaw]: facetValue
  };

  const rawDocs = await col.find(query).toArray();

  const docs = rawDocs.map(doc => ({
    _id: doc[ID] || '',
    _type: doc[TYPE] || '',
    _label: getFirstAvailableValue(doc, LABEL_KEYS, 'No Title'),
    _description: getFirstAvailableValue(doc, DESCRIPTION_KEYS, 'No description.')
  }));

  res.render('facet', {
    facetType: facetTypeRaw,
    facetValue,
    docs,
    facetList: [],
    filter_item: [],
    baseURI: BASE
  });
});

module.exports = router;
