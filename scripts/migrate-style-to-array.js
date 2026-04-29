/**
 * scripts/migrate-style-to-array.js
 * Artworks_RDF 컬렉션의 style 필드를 string → array로 변환
 * + 기존 단일 값을 5개 Style 값 중 하나로 정규화
 *
 * 실행: node scripts/migrate-style-to-array.js
 */
"use strict";
require("dotenv").config();
const mongoose = require("mongoose");

// 온톨로지 확정 Style 값 5개
const VALID_STYLES = ["단색화", "민중미술", "인상주의", "추상표현주의", "한국화"];

function pick(arr, i) { return arr[i % arr.length]; }

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB 연결");
  const db  = mongoose.connection.db;
  const col = db.collection("Artworks_RDF");

  // ① string인 style 필드 → 배열로 변환
  const stringDocs = await col.find({
    style: { $exists: true, $type: "string" }
  }).project({ _id: 1, style: 1 }).toArray();

  console.log(`📋 string style → array 변환 대상: ${stringDocs.length}개`);

  let done = 0;
  for (const doc of stringDocs) {
    // 기존 값이 유효한 Style이면 유지, 아니면 그대로 배열화
    const val = VALID_STYLES.includes(doc.style) ? doc.style : doc.style;
    await col.updateOne({ _id: doc._id }, { $set: { style: [val] } });
    done++;
  }
  console.log(`✅ ${done}개 string → array 변환 완료`);

  // ② style 없는 문서에 순환 삽입
  const noDocs = await col.find({
    style: { $exists: false }
  }).project({ _id: 1 }).toArray();

  console.log(`📋 style 없는 문서: ${noDocs.length}개 → 순환 삽입`);
  for (let i = 0; i < noDocs.length; i++) {
    await col.updateOne(
      { _id: noDocs[i]._id },
      { $set: { style: [pick(VALID_STYLES, i)] } }
    );
  }
  console.log(`✅ ${noDocs.length}개 style 삽입 완료`);

  // ③ 결과 확인
  const counts = {};
  for (const s of VALID_STYLES) {
    counts[s] = await col.countDocuments({ style: s });
  }
  console.log("\n📊 Style 분포:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}개`);
  }

  await mongoose.disconnect();
  console.log("\n✅ 마이그레이션 완료");
}

main().catch(e => { console.error(e); process.exit(1); });
