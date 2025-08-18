require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('../model');
const OnlineTutor = require('../model/onlineTutor');
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
  const cursor = OnlineTutor.find().cursor();
  for await (const t of cursor) {
    const entry = {
      '@id': `esl:online_tutor:${t._id}`,    // ✅ 고유 @id
      '@type': 'Online_Tutors',
      source: 'online_tutors',
      sourceId: String(t._id),
      label: t.name || 'Untitled',
      title: t.name ? (t.subject ? `${t.name} · ${t.subject}` : t.name) : 'Untitled',
      description: t.description || '',
      teachingArea: t.subject || '',
      hostCountry: '',
      studentType: undefined,
      email: t.email || '',
      updatedAt: new Date()
    };
    await fcol.updateOne(
      { source: 'online_tutors', sourceId: String(t._id) },
      { $set: entry },
      { upsert: true }
    );
    n++;
  }
  console.log(`[OK] backfilled ${n} online_tutors → esl`);
  await client.close();
  await mongoose.disconnect();
})();
