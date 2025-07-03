const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl';

router.get('/:id', async (req, res) => {
  const encodedId = req.params.id;
  const decodedId = decodeURIComponent(encodedId);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION_NAME);

    const item = await col.findOne({ "@id": decodedId });

    if (!item) {
      return res.status(404).render('error', { message: 'Detail not found', error: {} });
    }

    res.render('detail', { item });

  } catch (err) {
    console.error('❌ detail.js error:', err.message);
    res.status(500).render('error', { message: '❌ Error loading detail', error: err });
  } finally {
    client.close();
  }
});

module.exports = router;
