require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('../model');
const JobSeeker = require('../model/jobSeeker');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const FACET_COLL = 'esl';

(async () => {
  await connect();
  await new Promise(r => mongoose.connection.once('open', r));
  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  await client.connect();
  const fcol = client.db(DB_NAME).collection(FACET_COLL);

  let n = 0;
  const cursor = JobSeeker.find().cursor();
  for await (const s of cursor) {
    const entry = {
      '@id': `esl:job_seeker:${s._id}`,      // ✅ 고유 @id
      '@type': 'Job_Seekers',
      source: 'job_seekers',
      sourceId: String(s._id),
      label: s.name || 'Untitled',
      title: s.jobTitle || s.name || 'Untitled',
      description: s.description || '',
      hostCountry: s.preferredWorkLocation || s.nationality || '',
      studentType: undefined,
      teachingArea: s.major || '',
      email: s.email || '',
      updatedAt: new Date()
    };
    await fcol.updateOne(
      { source: 'job_seekers', sourceId: String(s._id) },
      { $set: entry },
      { upsert: true }
    );
    n++;
  }
  console.log(`[OK] backfilled ${n} job_seekers → esl`);
  await client.close();
  await mongoose.disconnect();
})();
