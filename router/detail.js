const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl';

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  const item = await col.findOne({ _id: new ObjectId(id) });

  if (!item) {
    return res.status(404).send('Not found');
  }

  res.render('detail', { item });
});

module.exports = router;
