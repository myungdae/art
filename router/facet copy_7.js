const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';

const LABEL = 'rdfs:label';
const DESCRIPTION = 'http://purl.org/dc/elements/1.1/description';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;const express = require('express');
  const router = express.Router();
  const { MongoClient } = require('mongodb');
  
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const DB_NAME = 'eventpool';
  const COLLECTION_NAME = process.env.COLLECTION || 'esl';
  
  router.get('/:type', async (req, res) => {
    const facetType = req.params.type;
    const filter = req.query.filter;
  
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION_NAME);
  
    console.log("✅ MONGO_URI:", MONGO_URI);
    console.log("✅ DB_NAME:", DB_NAME);
    console.log("✅ COLLECTION_NAME:", COLLECTION_NAME);
  
    // ✅ 기본 filterQuery: Job_Vacancies
    // let filterQuery = { "@type": "Job_Vacancies" };
    // let filter_item = [];
  
    let filterQuery = {
      "@type": { $in: ["Job_Vacancies", "http://esl.eventpool.kr/resource/Job_Vacancies"] }
    };
  
    if (filter) {
      const filters = Array.isArray(filter) ? filter : [filter];
      filters.forEach(f => {
        const [key, val] = f.split(':');
        if (key && val) {
          if (!filterQuery[key]) filterQuery[key] = { $in: [] };
          filterQuery[key].$in.push(val);
          filter_item.push({ key, val });
        }
      });
    }
  
    console.log("✅ 최종 filterQuery:", JSON.stringify(filterQuery, null, 2));
  
    // ✅ 데이터 조회
    const data = await col.find(filterQuery).limit(100).toArray();
    console.log("✅ 데이터 갯수:", data.length);
    console.log(JSON.stringify(data, null, 2));
  
    // ✅ _label / _description 생성
    data.forEach(item => {
      item._label =
        (item['http://www.w3.org/2000/01/rdf-schema#label'] && item['http://www.w3.org/2000/01/rdf-schema#label']['@value']) ||
        (item['rdfs:label'] && item['rdfs:label']['@value']) ||
        item['title'] ||
        item['dc:title'] ||
        item['@id'] ||
        'No Title';
  
      item._description =
        (item['http://purl.org/dc/elements/1.1/description'] && item['http://purl.org/dc/elements/1.1/description']['@value']) ||
        item['dc:description'] ||
        item['description'] ||
        'No description';
    });
  
    // ✅ 필터 필드 집계
    const facetFields = ['country', 'studentType', 'teachingArea'];
    const filtersData = [];
  
    for (let field of facetFields) {
      try {
        const agg = await col.aggregate([
          { $match: { "@type": "Job_Vacancies" } },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]).toArray();
  
        const values = agg
          .filter(entry => typeof entry._id === 'string' && entry._id.trim())
          .map(entry => ({
            value: entry._id,
            label: entry._id,
            count: entry.count
          }));
  
        if (values.length > 0) {
          filtersData.push({
            key: field,
            title: field.toUpperCase(),
            values
          });
        }
      } catch (err) {
        console.error(`Error processing facet field ${field}:`, err.message);
      }
    }
  
    // ✅ 렌더링
    res.render('facet', {
      data,
      filters: filtersData,
      filter_item
    });
  });
  
  module.exports = router;

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
      const [key, val] = f.split(':');
      if (!filterQuery[key]) filterQuery[key] = { $in: [] };
      filterQuery[key].$in.push(val);
      filter_item.push({ key, val });
    });
  }

  // ✅ 데이터 조회
  const data = await col.find(filterQuery).limit(100).toArray();

  // ✅ _label 설정
  data.forEach(item => {
    item._label = (item[LABEL] && item[LABEL]['@value']) || item['title'] || item['@id'] || 'No Title';
  });

  // ✅ 필터 필드 정의 및 집계
  const facetFields = ['country', 'studentType', 'teachingArea'];
  const filtersData = [];

  for (let field of facetFields) {
    try {
      const agg = await col.aggregate([
        { $match: {} },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();

      const values = agg
        .filter(entry => typeof entry._id === 'string' && entry._id.trim())
        .map(entry => ({
          value: entry._id,
          label: entry._id,
          count: entry.count
        }));

      if (values.length > 0) {
        filtersData.push({
          key: field,
          title: field.toUpperCase(),
          values
        });
      }
    } catch (err) {
      console.error(`Error processing facet field ${field}:`, err.message);
    }
  }

  // ✅ 렌더링
  res.render('facet', {
    data,
    filters: filtersData,
    filter_item
  });
});

module.exports = router;
