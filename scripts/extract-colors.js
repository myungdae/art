/**
 * scripts/extract-colors.js
 * Artworks_RDF 컬렉션의 imageUrl 에서 주요 색상(mainColor)을 추출해 DB에 저장
 *
 * 실행: node scripts/extract-colors.js
 * 옵션: --force   이미 mainColor 있는 문서도 재처리
 *       --limit N  최대 N개만 처리 (기본 9999)
 */

"use strict";
require("dotenv").config();

const mongoose = require("mongoose");
const { getColorFromURL } = require("color-thief-node");

/* ── 색상 팔레트: RGB → 색상 이름 매핑 (12색) ── */
const COLOR_PALETTE = [
  { name: "빨강",   nameEn: "Red",    rgb: [220,  38,  38] },
  { name: "주황",   nameEn: "Orange", rgb: [234, 120,  35] },
  { name: "노랑",   nameEn: "Yellow", rgb: [234, 179,   8] },
  { name: "연두",   nameEn: "Lime",   rgb: [132, 204,  22] },
  { name: "초록",   nameEn: "Green",  rgb: [ 34, 197,  94] },
  { name: "청록",   nameEn: "Teal",   rgb: [ 20, 184, 166] },
  { name: "파랑",   nameEn: "Blue",   rgb: [ 37, 107, 227] },
  { name: "남색",   nameEn: "Indigo", rgb: [ 99,  64, 215] },
  { name: "보라",   nameEn: "Purple", rgb: [168,  85, 247] },
  { name: "분홍",   nameEn: "Pink",   rgb: [236,  72, 153] },
  { name: "갈색",   nameEn: "Brown",  rgb: [120,  63,  18] },
  { name: "흰색",   nameEn: "White",  rgb: [245, 245, 240] },
  { name: "회색",   nameEn: "Gray",   rgb: [140, 140, 140] },
  { name: "검정",   nameEn: "Black",  rgb: [ 28,  28,  28] },
];

/* 유클리드 거리로 가장 가까운 색상 이름 반환 */
function nearestColor(r, g, b) {
  let best = COLOR_PALETTE[0];
  let bestDist = Infinity;
  for (const c of COLOR_PALETTE) {
    const dr = r - c.rgb[0], dg = g - c.rgb[1], db = b - c.rgb[2];
    const dist = dr*dr + dg*dg + db*db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best.name;  // 한글 색상명
}

/* 이미지 URL → 주요 색상 이름 (실패 시 null) */
async function extractMainColor(imageUrl) {
  try {
    const [r, g, b] = await getColorFromURL(imageUrl);
    return nearestColor(r, g, b);
  } catch {
    return null;
  }
}

/* ── main ── */
async function main() {
  const force = process.argv.includes("--force");
  const limitArg = process.argv.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 9999;

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB 연결");

  const db = mongoose.connection.db;
  const col = db.collection("Artworks_RDF");

  const query = { "imageUrl": { "$exists": true, "$ne": "" } };
  if (!force) query["mainColor"] = { "$exists": false };

  const total = await col.countDocuments(query);
  console.log(`📋 처리 대상: ${total}개 (force=${force}, limit=${limit})`);

  const cursor = col.find(query).limit(limit);
  let done = 0, ok = 0, fail = 0;

  for await (const doc of cursor) {
    done++;
    const color = await extractMainColor(doc.imageUrl);
    if (color) {
      await col.updateOne({ "_id": doc._id }, { "$set": { "mainColor": color } });
      ok++;
      process.stdout.write(`\r✅ ${done}/${total}  색상: ${color}   `);
    } else {
      fail++;
      process.stdout.write(`\r⚠️  ${done}/${total}  실패(imageUrl: ${doc.imageUrl?.slice(0,40)})   `);
    }
  }

  console.log(`\n\n완료 — 성공: ${ok}, 실패: ${fail}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
