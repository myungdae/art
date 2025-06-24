// ✅ router/facet.js (COLLECTION 활용 완성본)
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';
const LABEL = 'rdfs:label';
const DESCRIPTION = 'http://purl.org/dc/elements/1.1/description';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filter = req.query.filter;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME); // ✅ env에 정의된 컬렉션 사용

  // ✅ 필터 쿼리 구성
  let filterQuery = {
    '@type': BASE + facetType.slice(0, -1).replace('_', '_') // 예: Job_Vacancies → Job_Vacancy
  };

  if (filter) {
    const filters = Array.isArray(filter) ? filter : [filter];
    filters.forEach(f => {
      const [key, value] = f.split(':');
      filterQuery[key] = value;
    });
  }

  const docs = await col.find(filterQuery).limit(100).toArray();

  // ✅ 모든 필드에서 상위 필터 후보 추출
  let facets = {};
  docs.forEach(doc => {
    Object.keys(doc).forEach(key => {
      if (typeof doc[key] === 'string' && key !== '@id') {
        facets[key] = facets[key] || {};
        facets[key][doc[key]] = (facets[key][doc[key]] || 0) + 1;
      }
    });
  });

  const facetList = Object.entries(facets).map(([key, values]) => {
    return {
      _id: key,
      values: Object.entries(values).map(([val, count]) => ({ val, count }))
    };
  });

  res.render('facet', {
    facetType,
    facetList,
    docs,
    resource: BASE,
    titleKey: LABEL,
    descriptionKey: DESCRIPTION
  });
});

module.exports = router;
