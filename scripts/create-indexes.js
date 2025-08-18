// scripts/create-indexes.js
require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('../model'); // 앱에서 쓰는 연결 로직 재사용

async function waitForDbReady(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Mongo connection timeout'));
      setTimeout(check, 100);
    }
    // 이벤트로도 한 번 더 보장
    mongoose.connection.once('open', () => resolve());
    mongoose.connection.on('error', (e) => reject(e));
    check();
  });
}

(async () => {
  try {
    // 1) 앱과 동일한 방식으로 연결 시도
    await connect();

    // 2) 실제로 db 핸들이 준비될 때까지 대기
    await waitForDbReady();

    const db = mongoose.connection.db;
    console.log('[INFO] Connected to DB:', mongoose.connection.name);

    // ⬇️ 필요한 컬렉션/필드에 맞게 이름만 바꿔주세요
    const specs = [
      { coll: 'job_seekers',   index: { name: 'text', fullName: 'text', bio: 'text', skills: 'text' } },
      { coll: 'online_tutors', index: { name: 'text', title: 'text',  bio: 'text', subjects: 'text' } },
      // { coll: 'job_vacancies', index: { title: 'text', position: 'text', description: 'text' } }, // 필요 시
    ];

    for (const { coll, index } of specs) {
      try {
        // 컬렉션 존재 안 해도 createIndex는 컬렉션을 만들며 인덱스 생성(권한 필요)
        const res = await db.collection(coll).createIndex(index);
        console.log(`[OK] ${coll} -> ${res}`);
      } catch (e) {
        console.error(`[FAIL] ${coll}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('[FATAL]', e.message);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();
