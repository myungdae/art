const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';

router.get('/:id', async (req, res) => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  const id = decodeURIComponent(req.params.id);
  const fullId = `http://esl.eventpool.kr/resource/${id}`; // ✅ 반드시 전체 URI로

  const doc = await col.findOne({ '@id': fullId });

  if (!doc) {
    return res.status(404).send('❌ Resource not found');
  }

  res.render('rdf/view', { doc });  // ✅ 올바른 뷰 경로
});

module.exports = router;
