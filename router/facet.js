const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl'; // ✅ 실제 MongoDB 컬렉션 이름
const BASE = 'http://esl.eventpool.kr/resource/';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filter = req.query.filter;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  // ✅ 필터 쿼리
  const filterQuery = {
    "@type": {
      $in: [facetType, `${BASE}${facetType}`]
    }
  };

  if (filter) {
    // 💡 filter 파라미터가 있을 경우
    filterQuery["rdfs:label.@value"] = { $regex: filter, $options: 'i' };
  }

  console.log("📌 facetType:", facetType);
  console.log("📌 filterQuery:", JSON.stringify(filterQuery, null, 2));

  const data = await col.find(filterQuery).toArray();

  console.log(`✅ 데이터 갯수: ${data.length}`);

  res.render('facet', {
    data,
    filters: [],  // 필요시 확장
    type: facetType
  });
});

module.exports = router;
