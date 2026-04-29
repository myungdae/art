/**
 * scripts/extract-colors.js
 * Artworks_RDF 컬렉션의 imageUrl 에서 주요 색상(mainColor)을 추출해 DB에 저장
 *
 * 실행: node scripts/extract-colors.js
 * 옵션: --force      이미 mainColor 있는 문서도 재처리
 *       --limit=N    최대 N개만 처리 (기본 9999)
 */
"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const { extractMainColor } = require("../utils/colorExtractor");

async function main() {
  const force    = process.argv.includes("--force");
  const limitArg = process.argv.find(a => a.startsWith("--limit="));
  const limit    = limitArg ? parseInt(limitArg.split("=")[1], 10) : 9999;

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB 연결");

  const db  = mongoose.connection.db;
  const col = db.collection("Artworks_RDF");

  const query = { imageUrl: { $exists: true, $ne: "" } };
  if (!force) query.mainColor = { $exists: false };

  const total = await col.countDocuments(query);
  console.log(`📋 처리 대상: ${total}개 (force=${force}, limit=${limit})`);

  const cursor = col.find(query).limit(limit);
  let done = 0, ok = 0, fail = 0;

  for await (const doc of cursor) {
    done++;
    const color = await extractMainColor(doc.imageUrl);
    if (color) {
      await col.updateOne({ _id: doc._id }, { $set: { mainColor: color } });
      ok++;
      process.stdout.write(`\r✅ ${done}/${total}  색상: ${color}            `);
    } else {
      fail++;
      process.stdout.write(`\r⚠️  ${done}/${total}  실패 (${doc.imageUrl?.slice(0, 50)})   `);
    }
  }

  console.log(`\n\n완료 — 성공: ${ok}, 실패: ${fail}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
