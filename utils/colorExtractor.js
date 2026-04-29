/**
 * utils/colorExtractor.js
 * 이미지 URL → 한글 색상명 변환 공용 모듈
 *
 * 사용법:
 *   const { extractMainColor } = require('../utils/colorExtractor');
 *   const color = await extractMainColor('https://...image.jpg');
 *   // → "파랑" | "빨강" | null (이미지 로드 실패 시)
 */
"use strict";

const { getColorFromURL } = require("color-thief-node");

/* ── 14색 팔레트 ── */
const COLOR_PALETTE = [
  { name: "빨강",  rgb: [220,  38,  38] },
  { name: "주황",  rgb: [234, 120,  35] },
  { name: "노랑",  rgb: [234, 179,   8] },
  { name: "연두",  rgb: [132, 204,  22] },
  { name: "초록",  rgb: [ 34, 197,  94] },
  { name: "청록",  rgb: [ 20, 184, 166] },
  { name: "파랑",  rgb: [ 37, 107, 227] },
  { name: "남색",  rgb: [ 99,  64, 215] },
  { name: "보라",  rgb: [168,  85, 247] },
  { name: "분홍",  rgb: [236,  72, 153] },
  { name: "갈색",  rgb: [120,  63,  18] },
  { name: "흰색",  rgb: [245, 245, 240] },
  { name: "회색",  rgb: [140, 140, 140] },
  { name: "검정",  rgb: [ 28,  28,  28] },
];

/**
 * RGB → 팔레트에서 유클리드 거리가 가장 가까운 색상명 반환
 */
function nearestColor(r, g, b) {
  let best = COLOR_PALETTE[0];
  let bestDist = Infinity;
  for (const c of COLOR_PALETTE) {
    const dr = r - c.rgb[0], dg = g - c.rgb[1], db = b - c.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best.name;
}

/**
 * 이미지 URL → 주요 색상 한글명
 * @param {string} imageUrl
 * @returns {Promise<string|null>}  성공: "파랑" 등 / 실패: null
 */
async function extractMainColor(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  try {
    const [r, g, b] = await getColorFromURL(imageUrl);
    return nearestColor(r, g, b);
  } catch (e) {
    // 이미지 로드 실패, 지원하지 않는 형식 등 → 무시하고 null 반환
    console.warn(`[colorExtractor] 색상 추출 실패 (${imageUrl?.slice(0, 60)}): ${e.message}`);
    return null;
  }
}

module.exports = { extractMainColor, nearestColor, COLOR_PALETTE };
