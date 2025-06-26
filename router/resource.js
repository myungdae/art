const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const uri = BASE + id;  // ✅ encodeURIComponent 제거

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const doc = await collection.findOne({ '@id': uri });

    if (!doc) {
      return res.status(404).send('❌ Resource not found');
    }

    res.render('rdf/view', { doc });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Internal Server Error');
  } finally {
    await client.close();
  }
});

module.exports = router;
