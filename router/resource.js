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

  // Prepare related fields
  const fieldMap = [
    { key: 'Duration', label: 'Duration' },
    { key: 'Pay', label: 'Pay' },
    { key: 'Housing', label: 'Housing' },
    { key: 'Email', label: 'Email' },
    { key: 'Company Name', label: 'Company Name' },
    { key: 'Job Location', label: 'Job Location' },
    { key: 'Cellphone Number', label: 'Cellphone Number' },
    { key: 'Skype ID', label: 'Skype ID' },
    { key: 'WeChat ID', label: 'WeChat ID' },
    { key: 'Homepage', label: 'Homepage' }
  ];

  const relatedFields = fieldMap
    .filter(f => doc[f.key])
    .map(f => ({
      label: f.label,
      value: doc[f.key]
    }));

  res.render('resource', { doc, relatedFields });
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
