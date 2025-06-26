const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';

router.get('/:id', async (req, res) => {
  const rawId = req.params.id;
  const decodedId = decodeURIComponent(rawId);
  const normalizedId = decodedId.replace(/ /g, '_'); // 핵심 수정
  const fullId = BASE + normalizedId;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  try {
    const doc = await col.findOne({ '@id': fullId });

    if (!doc) {
      console.log('❌ Not Found:', fullId);
      return res.status(404).send('❌ Resource not found');
    }

    res.render('resource/detail', { doc });
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).send('❌ Internal Server Error');
  } finally {
    await client.close();
  }
});

module.exports = router;
