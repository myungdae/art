// ✅ router/facet.js (필터 키 제한 적용 + label/description 추출 포함)
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const sanitizeHtml = require('sanitize-html');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';

// ✅ 허용할 필터 키 목록
const ALLOWED_FACETS = ['country', 'studentType', 'teachingArea'];

const LABEL_KEYS = ['rdfs:label', 'http://www.w3.org/2000/01/rdf-schema#label'];
const DESCRIPTION_KEYS = ['http://purl.org/dc/elements/1.1/description', 'description'];

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filter = req.query.filter;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  // ✅ '@type' 그대로 사용
  let filterQuery = {
    '@type': facetType
  };

  // ✅ 필터 조건 추가
  if (filter) {
    const filters = Array.isArray(filter) ? filter : [filter];
    filters.forEach(f => {
      const [key, value] = f.split(':');
      filterQuery[key] = value;
    });
  }

  const docs = await col.find(filterQuery).limit(100).toArray();

  // ✅ 상위 필터 목록 생성 (허용된 키만)
  let facets = {};
  docs.forEach(doc => {
    ALLOWED_FACETS.forEach(key => {
      if (doc[key]) {
        const value = typeof doc[key] === 'string' ? doc[key] : (doc[key]['@value'] || doc[key]['@id']);
        if (value) {
          facets[key] = facets[key] || {};
          facets[key][value] = (facets[key][value] || 0) + 1;
        }
      }
    });
  });

  // ✅ label/description 정리
  const cleanDocs = docs.map(doc => {
    // label
    let label = '';
    for (const key of LABEL_KEYS) {
      if (doc[key] && doc[key]['@value']) {
        label = doc[key]['@value'];
        break;
      }
    }
    doc._label = label || 'No Title';

    // description
    for (const key of DESCRIPTION_KEYS) {
      if (doc[key]) {
        const val = typeof doc[key] === 'string' ? doc[key] : doc[key]['@value'];
        doc._description = sanitizeHtml(val || '', { allowedTags: [], allowedAttributes: {} });
        break;
      }
    }

    return doc;
  });

  // ✅ facet 배열 변환
  const facetList = Object.entries(facets).map(([key, values]) => {
    return {
      _id: key,
      values: Object.entries(values).map(([val, count]) => ({ val, count }))
    };
  });

  res.render('facet', {
    facetType,
    facetList,
    docs: cleanDocs,
    resource: BASE,
    titleKey: '_label',
    descriptionKey: '_description'
  });
});

module.exports = router;
