const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl';

// 리소스 상세
router.get('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const fullId = `http://esl.eventpool.kr/resource/${name}`;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  const doc = await col.findOne({ '@id': fullId });
  if (!doc) {
    return res.status(404).send(`Resource not found: ${fullId}`);
  }

  res.render('resource', { doc });
});

// INVERSE RELATION 검색
router.get('/inverse/:value', async (req, res) => {
  const value = decodeURIComponent(req.params.value);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  const data = await col.find({
    $or: [
      { hostCountry: value },
      { studentType: value },
      { teachingArea: value }
    ]
  }).toArray();

  res.render('resource-inverse', { value, data });
});

module.exports = router;
