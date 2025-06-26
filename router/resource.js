const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 정보
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';

// GET /resource/:name → 특정 리소스 상세 페이지
router.get('/:name', async (req, res) => {
  const name = req.params.name;
  const id = BASE + name;

  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION_NAME);

    const doc = await col.findOne({ '@id': id });

    if (!doc) {
      return res.render('rdf/view', { notFound: true });
    }

    const label = doc['rdfs:label'] || 'No Title';
    const description = doc['http://purl[dot]org/dc/elements/1[dot]1/description'] || '';

    res.render("rdf/view", { doc, label, description }); // ✅ 수정된 파일명
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


module.exports = router;
