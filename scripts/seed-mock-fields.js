/**
 * scripts/seed-mock-fields.js
 * Artworks_RDF 컬렉션에 orientation, size, mainColor, material mockup 데이터 삽입
 *
 * 실행: node scripts/seed-mock-fields.js
 */
"use strict";
require("dotenv").config();
const mongoose = require("mongoose");

const ORIENTATIONS = ["Horizontal", "Square", "Vertical"];
const SIZES        = ["Small", "Medium", "Oversized"];
const COLORS       = ["빨강","주황","노랑","연두","초록","청록","파랑","남색","보라","분홍","갈색","회색","검정","흰색"];
const MATERIALS    = ["Acrylic","Bronze","Canvas","Glass","Hanji","Resin","Stainless_Steel","Steel","Wood"];
const STYLES       = ["단색화","민중미술","인상주의","추상표현주의","한국화"];
const THEMES       = ["기억","노동","도시","여성","자연","전쟁"];

function pick(arr, i) { return arr[i % arr.length]; }

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB 연결");
  const db  = mongoose.connection.db;
  const col = db.collection("Artworks_RDF");

  const docs = await col.find({}).project({ _id: 1 }).toArray();
  console.log(`📋 총 ${docs.length}개 작품에 mockup 값 삽입`);

  let done = 0;
  for (let i = 0; i < docs.length; i++) {
    await col.updateOne(
      { _id: docs[i]._id },
      { $set: {
          orientation: pick(ORIENTATIONS, i),
          size:        pick(SIZES,        i),
          mainColor:   pick(COLORS,       i),
          material:    [pick(MATERIALS,   i)],
          style:       [pick(STYLES,      i)],   // 배열로 저장
          theme:       [pick(THEMES,      i)],
      }}

    );
    done++;
    if (done % 20 === 0) process.stdout.write(`\r  ${done}/${docs.length} 완료...`);
  }

  console.log(`\n✅ ${done}개 작품에 orientation / size / mainColor / material 삽입 완료`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
