const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION = 'esl';

router.get('/:id', async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const client = new MongoClient(MONGO_URI);
  await client.connect();const express = require('express');
  const router = express.Router();
  const { MongoClient } = require('mongodb');
  
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const DB_NAME = 'eventpool';
  const COLLECTION = 'esl';
  
  router.get('/resource/:id', async (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const fullId = `http://esl.eventpool.kr/resource/${id}`;
    const client = new MongoClient(MONGO_URI);
  
    try {
      await client.connect();
      const db = client.db(DB_NAME);
      const col = db.collection(COLLECTION);
  
      const doc = await col.findOne({ "@id": fullId });
      if (!doc) {
        return res.status(404).send('Resource not found');
      }
  
      res.render('resource', { doc });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } finally {
      await client.close();
    }
  });
  
  module.exports = router;

  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const doc = await col.findOne({ "@id": id });
  if (!doc) {
    return res.status(404).send('Resource not found');
  }

  res.render('resource-detail', { doc });
});

module.exports = router;
