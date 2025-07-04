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
  const col = db.collection(COLLECTION_NAME);const express = require('express');
  const router = express.Router();
  const { MongoClient, ObjectId } = require('mongodb');
  
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/eventpool';
  const DB_NAME = 'eventpool';
  const COLLECTION_NAME = process.env.COLLECTION || 'esl';
  
  router.get('/:id', async (req, res) => {
    const id = req.params.id;
  
    const client = new MongoClient(MONGO_URI);
    try {
      await client.connect();
      const db = client.db(DB_NAME);
      const col = db.collection(COLLECTION_NAME);
  
      const item = await col.findOne({ _id: new ObjectId(id) });
  
      if (!item) {
        return res.status(404).send('Not found');
      }
  
      res.render('detail', { item });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error')const express = require('express');
      const router = express.Router();
      const { MongoClient, ObjectId } = require('mongodb');
      
      const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/eventpool';
      const DB_NAME = 'eventpool';
      const COLLECTION_NAME = process.env.COLLECTION || 'esl';
      
      router.get('/:id', async (req, res) => {
        const id = req.params.id;
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const col = db.collection(COLLECTION_NAME);
      
        let query;
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
          // ObjectId 형태라면 ObjectId로 검색
          query = { _id: new ObjectId(id) };
        } else {
          // 그렇지 않으면 @id로 검색
          query = { '@id': decodeURIComponent(id) };
        }
      
        const item = await col.findOne(query);
      
        if (!item) {
          return res.status(404).send('Not found');
        }
      
        res.render('detail', { item });
      });
      
      module.exports = router;
;
    } finally {
      await client.close();
    }
  });
  
  module.exports = router;


  const item = await col.findOne({ _id: new ObjectId(id) });

  if (!item) {
    return res.status(404).send('Not found');
  }

  res.render('detail', { item });
});

module.exports = router;
