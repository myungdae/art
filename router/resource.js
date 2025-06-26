const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';

const LABEL = 'rdfs:label';
const DESCRIPTION = 'http://purl.org/dc/elements/1.1/description';
const TYPE = '@type';
const ID = '@id';

// ✅ 상세 페이지 라우터
router.get('/:id', async (req, res) => {
  const idParam = req.params.id;
  const fullId = BASE + idParam;

  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION_NAME);

    const doc = await col.findOne({ [ID]: fullId });

    if (!doc) {
      return res.status(404).render('404', { message: '❌ Resource not found' });
    }

    res.render('resource', {
      title: doc[LABEL] || 'No Title',
      description: doc[DESCRIPTION] || 'No Description',
      doc
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Internal Server Error');
  }
});

module.exports = router;
