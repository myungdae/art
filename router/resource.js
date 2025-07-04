const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION = 'esl';

router.get('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const fullId = `http://esl.eventpool.kr/resource/${name}`;
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    // 1️⃣ 먼저 정확한 리소스를 찾음
    const doc = await col.findOne({ "@id": fullId });
    if (doc) {
      return res.render('resource', { doc });
    }

    // 2️⃣ 정확한 리소스가 없으면 owl:inverseOf 처럼 hostCountry가 name인 Job 검색
    const relatedJobs = await col.find({ hostCountry: name }).toArray();
    if (relatedJobs.length > 0) {
      return res.render('resource-inverse', { title: name, jobs: relatedJobs });
    }

    // 3️⃣ 아무것도 없으면 404
    res.status(404).send(`No resource or related jobs found for: ${name}`);

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

module.exports = router;
