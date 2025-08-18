// scripts/create-esl-index.js
require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('../model');

(async () => {
  try {
    await connect();
    await new Promise((r) => mongoose.connection.once('open', r));
    const db = mongoose.connection.db;
    const col = db.collection('esl');

    // 넓게 커버(필요 시 줄이셔도 됩니다)
    const idx = {
      name: 'text', title: 'text', fullName: 'text', position: 'text',
      description: 'text', bio: 'text', skills: 'text', subjects: 'text',
      teachingArea: 'text', hostCountry: 'text', studentType: 'text',
      label: 'text', organization: 'text', department: 'text'
    };

    const res = await col.createIndex(idx);
    console.log('[OK] esl ->', res);
  } catch (e) {
    console.error('[FAIL]', e.message);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();
