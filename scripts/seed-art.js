/**
 * scripts/seed-art.js
 * art-platform.ttl 을 파싱하여 MongoDB artplatform DB에 시딩합니다.
 *
 * 사용법:
 *   cd /path/to/artapp
 *   node scripts/seed-art.js
 *
 * 환경 변수: .env 의 MONGO_URI 를 사용합니다.
 */
"use strict";

require("dotenv").config();
const fs         = require("fs");
const path       = require("path");
const { MongoClient } = require("mongodb");

// ─── Tiny TTL parser ──────────────────────────────────────────────────────────
// 완전한 RDF 파서 대신 art-platform.ttl 형식에 맞춘 경량 파서입니다.
function parseTTL(ttlText) {
  const prefixes = {};
  const triples  = [];

  // 1) prefix 추출
  for (const m of ttlText.matchAll(/^@prefix\s+(\w*|\w+):\s+<([^>]+)>\s*\./gm)) {
    prefixes[m[1]] = m[2];
  }

  function expand(term) {
    if (!term) return null;
    term = term.trim().replace(/,$/, "").replace(/;$/, "").replace(/\.$/, "");
    if (term.startsWith("<") && term.endsWith(">")) return term.slice(1, -1);
    if (term.startsWith('"') || term.startsWith("'")) {
      // literal — strip quotes + ^^xsd:…
      return term.replace(/^["']|["'].*$/g, "").replace(/\^\^.*$/, "").trim();
    }
    // prefixed name
    const colon = term.indexOf(":");
    if (colon > -1) {
      const prefix = term.slice(0, colon);
      const local  = term.slice(colon + 1);
      if (prefixes[prefix] !== undefined) return prefixes[prefix] + local;
    }
    return term;
  }

  // 2) Remove comments
  const clean = ttlText
    .replace(/#[^\n]*/g, "")
    .replace(/\r/g, "");

  // 3) Split into statements by "."
  const stmts = clean.split(/\s*\.\s*(?=\n|$)/);

  for (const stmt of stmts) {
    const parts = stmt.trim().split(/\s+/);
    if (parts.length < 3) continue;

    // Turtle allows predicate lists with ";" and object lists with ","
    // We handle only simple subject predicate object here
    const subj = expand(parts[0]);
    if (!subj) continue;

    let i = 1;
    while (i < parts.length - 1) {
      const pred = expand(parts[i]);
      if (!pred) { i++; continue; }
      let obj = "";
      // collect object (may span multiple tokens for quoted strings)
      if (parts[i+1] && parts[i+1].startsWith('"')) {
        let j = i + 1;
        let collecting = parts[j];
        while (!collecting.match(/["'](\^\^|@|\s*[,;.]|$)/) && j < parts.length - 1) {
          j++;
          collecting += " " + parts[j];
        }
        obj = expand(collecting);
        i = j + 1;
      } else {
        obj = expand(parts[i+1]);
        i += 2;
      }
      if (subj && pred && obj) triples.push([subj, pred, obj]);
      // skip ";" or "," tokens
      if (parts[i] === ";" || parts[i] === ",") i++;
    }
  }

  return triples;
}

// ─── TTL → Mongo documents ───────────────────────────────────────────────────
const ART_NS   = "http://art.example.org/ontology/";
const RES_NS   = "http://art.example.org/resource/";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

const CLASS_COLL_MAP = {
  [`${ART_NS}Artwork`]:     "Artworks_RDF",
  [`${ART_NS}Artist`]:      "Artists_RDF",
  [`${ART_NS}Gallery`]:     "Galleries_RDF",
  [`${ART_NS}Exhibition`]:  "Exhibitions_RDF",
  [`${ART_NS}AuctionHouse`]:"Auctions_RDF",
  [`${ART_NS}PriceRecord`]: "PriceRecords_RDF",
};

const PROP_FIELD_MAP = {
  [`${ART_NS}artworkTitle`]:  "title",
  [`${ART_NS}artistName`]:    "artistName",
  [`${ART_NS}creationYear`]:  "creationYear",
  [`${ART_NS}belongsToGenre`]:"genre",
  [`${ART_NS}belongsToStyle`]:"style",
  [`${ART_NS}usesMedium`]:    "medium",
  [`${ART_NS}usesMaterial`]:  "material",
  [`${ART_NS}createdBy`]:     "createdBy",
  [`${ART_NS}exhibitedIn`]:   "exhibitedIn",
  [`${ART_NS}hasPriceRecord`]:"hasPriceRecord",
  [`${ART_NS}heldBy`]:        "heldBy",
  [`${ART_NS}holds`]:         "holds",
  [`${ART_NS}includesArtwork`]:"includesArtwork",
  [`${ART_NS}priceDate`]:     "priceDate",
  [`${ART_NS}priceValue`]:    "priceValue",
  [RDFS_LABEL]:               "_label",
};

// Helper: local name from URI
function localName(uri) {
  const last = uri.split(/[#/]/).pop();
  return last ? decodeURIComponent(last.replace(/_/g, " ")) : uri;
}

function buildDocs(triples) {
  // group by subject
  const subjectMap = {};
  for (const [s, p, o] of triples) {
    if (!subjectMap[s]) subjectMap[s] = { "@id": s, _uri: s };
    const obj = subjectMap[s];

    if (p === RDF_TYPE) {
      obj._type = o;
    } else if (p === RDFS_LABEL) {
      obj._label = obj._label || o;
    } else if (PROP_FIELD_MAP[p]) {
      const field = PROP_FIELD_MAP[p];
      const val   = o.startsWith("http") ? localName(o) : o;
      if (obj[field] !== undefined) {
        // make array
        if (!Array.isArray(obj[field])) obj[field] = [obj[field]];
        obj[field].push(val);
      } else {
        obj[field] = val;
      }
    }
  }

  // assign _class and _label fallback
  const docs = {};
  for (const [uri, obj] of Object.entries(subjectMap)) {
    const coll = CLASS_COLL_MAP[obj._type];
    if (!coll) continue;
    obj._class   = coll.replace("_RDF", "");
    obj._label   = obj._label || obj.title || obj.artistName || localName(uri);
    obj.updatedAt = new Date();
    obj.createdAt = new Date();
    if (!docs[coll]) docs[coll] = [];
    docs[coll].push(obj);
  }

  return docs;
}

// ─── Sample data enrichment ──────────────────────────────────────────────────
// TTL 샘플 데이터 외에 작품/작가 샘플 데이터를 추가합니다.
const SAMPLE_ARTWORKS = [
  { title: "어디서 무엇이 되어 다시 만나랴", artistName: "김환기", creationYear: "1970", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "점화 5-IV-71 #200", artistName: "김환기", creationYear: "1971", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "여름 #2-68", artistName: "김환기", creationYear: "1968", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "빨간 달", artistName: "박수근", creationYear: "1960", genre: "회화", style: "한국화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "나무와 두 여인", artistName: "박수근", creationYear: "1962", genre: "회화", style: "한국화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "봄의 회화", artistName: "이우환", creationYear: "1978", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "관계항 — 무한의 그물망", artistName: "이우환", creationYear: "1995", genre: "설치", style: "단색화", medium: "Mixed Media", material: ["Stone", "Steel"], country: "대한민국" },
  { title: "오월판화 10", artistName: "오윤", creationYear: "1985", genre: "판화", style: "민중미술", medium: "Ink", material: "Hanji", country: "대한민국" },
  { title: "마케팅 I", artistName: "오윤", creationYear: "1980", genre: "판화", style: "민중미술", medium: "Ink", material: "Hanji", country: "대한민국" },
  { title: "모내기", artistName: "신학철", creationYear: "1987", genre: "회화", style: "민중미술", medium: "Acrylic", material: "Canvas", country: "대한민국" },
  { title: "무제 #1", artistName: "박서보", creationYear: "1975", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "묘법 No.28-75", artistName: "박서보", creationYear: "1975", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "영겁의 새벽", artistName: "정상화", creationYear: "1979", genre: "회화", style: "단색화", medium: "Acrylic", material: "Canvas", country: "대한민국" },
  { title: "작품 82-A", artistName: "윤형근", creationYear: "1982", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "청다색", artistName: "윤형근", creationYear: "1978", genre: "회화", style: "단색화", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "사유", artistName: "김종영", creationYear: "1970", genre: "조각", style: "추상표현주의", medium: "Bronze", material: "Bronze", country: "대한민국" },
  { title: "연꽃", artistName: "장우성", creationYear: "1960", genre: "회화", style: "한국화", medium: "Ink", material: "Hanji", country: "대한민국" },
  { title: "백두산", artistName: "변관식", creationYear: "1950", genre: "회화", style: "한국화", medium: "Ink", material: "Hanji", country: "대한민국" },
  { title: "군상 1", artistName: "임옥상", creationYear: "1983", genre: "회화", style: "민중미술", medium: "Oil Painting", material: "Canvas", country: "대한민국" },
  { title: "두 개의 반구", artistName: "최만린", creationYear: "1968", genre: "조각", style: "추상표현주의", medium: "Bronze", material: "Bronze", country: "대한민국" },
];

const SAMPLE_ARTISTS = [
  { artistName: "김환기", country: "대한민국", movement: "단색화", genre: ["회화"], bio: "한국 추상미술의 선구자. 뉴욕 시기의 점화 시리즈로 유명." },
  { artistName: "박수근", country: "대한민국", movement: "한국 근대미술", genre: ["회화"], bio: "서민의 일상을 따뜻한 시선으로 담은 화가." },
  { artistName: "이우환", country: "대한민국", movement: "단색화", genre: ["회화", "설치"], bio: "모노하 운동의 중심 인물. 관계항 시리즈로 세계적 명성." },
  { artistName: "박서보", country: "대한민국", movement: "단색화", genre: ["회화"], bio: "묘법 시리즈. 한국 단색화의 거장." },
  { artistName: "오윤", country: "대한민국", movement: "민중미술 1980s", genre: ["판화", "회화"], bio: "민중미술 운동의 대표 작가. 목판화로 사회적 메시지 전달." },
  { artistName: "정상화", country: "대한민국", movement: "단색화", genre: ["회화"], bio: "격자 패턴과 단색조로 유명한 단색화 작가." },
  { artistName: "윤형근", country: "대한민국", movement: "단색화", genre: ["회화"], bio: "청다색(靑茶色) 시리즈. 극도의 절제된 색채 표현." },
  { artistName: "신학철", country: "대한민국", movement: "민중미술 1980s", genre: ["회화"], bio: "역사적 현실을 직시한 민중미술 화가." },
  { artistName: "김종영", country: "대한민국", movement: "한국 근대미술", genre: ["조각"], bio: "한국 추상조각의 선구자." },
  { artistName: "임옥상", country: "대한민국", movement: "민중미술 1980s", genre: ["회화"], bio: "민중미술 운동 참여. 역사와 사회를 담은 대형 작품." },
];

const SAMPLE_GALLERIES = [
  { name: "국립현대미술관", country: "대한민국", genre: ["회화", "조각", "설치", "미디어아트"], description: "한국 최대의 국립 현대미술관. 과천·덕수궁·서울·청주 4개 관." },
  { name: "리움미술관", country: "대한민국", genre: ["회화", "조각", "설치"], description: "삼성문화재단 운영. 고미술과 현대미술을 함께 소장." },
  { name: "아라리오갤러리", country: "대한민국", genre: ["회화", "설치", "미디어아트"], description: "천안·서울 소재. 국내외 현대미술 전시." },
  { name: "학고재갤러리", country: "대한민국", genre: ["회화", "조각"], description: "인사동 소재. 한국 전통미술과 현대미술 전문." },
  { name: "갤러리현대", country: "대한민국", genre: ["회화", "조각", "미디어아트"], description: "1970년 설립. 한국 화단의 역사와 함께한 갤러리." },
  { name: "페이스갤러리 서울", country: "대한민국", genre: ["회화", "설치", "조각"], description: "뉴욕 기반 국제 갤러리 서울 지점." },
  { name: "Tate Modern", country: "영국", genre: ["회화", "조각", "설치", "미디어아트"], description: "런던 소재 세계 최대 현대미술관 중 하나." },
  { name: "MoMA", country: "미국", genre: ["회화", "조각", "사진", "미디어아트"], description: "뉴욕 현대미술관. 세계 현대미술의 성지." },
  { name: "Centre Pompidou", country: "프랑스", genre: ["회화", "설치", "미디어아트"], description: "파리 퐁피두 센터. 유럽 현대미술의 거점." },
  { name: "guggenheim Museum", country: "미국", genre: ["회화", "조각", "설치"], description: "뉴욕 구겐하임 미술관. 프랭크 로이드 라이트 설계 건물로도 유명." },
];

const SAMPLE_EXHIBITIONS = [
  { name: "단색화의 예술", genre: ["회화"], country: "대한민국", description: "한국 단색화 운동의 역사와 현재를 조망하는 전시.", year: "2023" },
  { name: "민중미술 40년", genre: ["회화", "판화"], country: "대한민국", description: "1980년대 민중미술 운동 40주년 기념 특별전.", year: "2022" },
  { name: "김환기: 어디서 무엇이 되어", genre: ["회화"], country: "대한민국", description: "김환기 탄생 100주년 기념 대규모 회고전.", year: "2013" },
  { name: "이우환: 관계항", genre: ["설치", "조각"], country: "대한민국", description: "이우환의 관계항 시리즈를 중심으로 한 전시.", year: "2024" },
  { name: "한국 현대미술의 여명", genre: ["회화", "조각"], country: "대한민국", description: "1960~70년대 한국 현대미술 태동기 조명.", year: "2021" },
];

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI 환경 변수가 없습니다."); process.exit(1); }

  console.log("🔗 MongoDB 연결 중…");
  const client = new MongoClient(uri);
  await client.connect();
  console.log("✅ 연결 완료");

  const db = client.db(); // URI에 포함된 DB명 사용 (artplatform)

  // ── TTL 파싱
  const ttlPath = path.join(__dirname, "../art-platform.ttl");
  const ttlText = fs.readFileSync(ttlPath, "utf-8");
  console.log("📖 TTL 파싱 중…");
  const triples = parseTTL(ttlText);
  console.log(`   ${triples.length}개 트리플 추출`);

  const ttlDocs = buildDocs(triples);
  for (const [coll, docs] of Object.entries(ttlDocs)) {
    if (!docs.length) continue;
    console.log(`   ${coll}: ${docs.length}건 (TTL)`);
    await db.collection(coll).insertMany(docs, { ordered: false }).catch(() => {});
  }

  // ── 샘플 데이터 삽입 (중복 제거: title+artistName 기준)
  console.log("\n📦 샘플 작품 삽입…");
  for (const art of SAMPLE_ARTWORKS) {
    const exists = await db.collection("Artworks_RDF").findOne({ title: art.title });
    if (!exists) {
      await db.collection("Artworks_RDF").insertOne({
        ...art,
        _class: "Artworks",
        _label: art.title,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
      process.stdout.write(".");
    }
  }

  console.log("\n\n📦 샘플 작가 삽입…");
  for (const artist of SAMPLE_ARTISTS) {
    const exists = await db.collection("Artists_RDF").findOne({ artistName: artist.artistName });
    if (!exists) {
      await db.collection("Artists_RDF").insertOne({
        ...artist,
        _class: "Artists",
        _label: artist.artistName,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
      process.stdout.write(".");
    }
  }

  console.log("\n\n📦 샘플 갤러리 삽입…");
  for (const gal of SAMPLE_GALLERIES) {
    const exists = await db.collection("Galleries_RDF").findOne({ name: gal.name });
    if (!exists) {
      await db.collection("Galleries_RDF").insertOne({
        ...gal,
        _class: "Galleries",
        _label: gal.name,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
      process.stdout.write(".");
    }
  }

  console.log("\n\n📦 샘플 전시 삽입…");
  for (const ex of SAMPLE_EXHIBITIONS) {
    const exists = await db.collection("Exhibitions_RDF").findOne({ name: ex.name });
    if (!exists) {
      await db.collection("Exhibitions_RDF").insertOne({
        ...ex,
        _class: "Exhibitions",
        _label: ex.name,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
      process.stdout.write(".");
    }
  }

  // ── 인덱스 생성
  console.log("\n\n🔍 인덱스 생성…");
  const indexDefs = [
    { coll: "Artworks_RDF",    fields: [{ _class: 1 }, { genre: 1 }, { style: 1 }, { medium: 1 }, { artistName: 1 }] },
    { coll: "Artists_RDF",     fields: [{ _class: 1 }, { country: 1 }, { movement: 1 }] },
    { coll: "Galleries_RDF",   fields: [{ _class: 1 }, { country: 1 }] },
    { coll: "Exhibitions_RDF", fields: [{ _class: 1 }, { genre: 1 }] },
    { coll: "Auctions_RDF",    fields: [{ _class: 1 }] },
  ];
  for (const def of indexDefs) {
    for (const idx of def.fields) {
      await db.collection(def.coll).createIndex(idx).catch(() => {});
    }
  }

  // ── 결과 출력
  console.log("\n✅ 시딩 완료!\n");
  for (const [coll] of Object.entries({ Artworks_RDF: 1, Artists_RDF: 1, Galleries_RDF: 1, Exhibitions_RDF: 1, Auctions_RDF: 1 })) {
    const cnt = await db.collection(coll).countDocuments({});
    console.log(`   ${coll.replace("_RDF", "").padEnd(14)} : ${cnt}건`);
  }

  await client.close();
  console.log("\n🔒 MongoDB 연결 종료");
}

main().catch((e) => {
  console.error("❌ 오류:", e);
  process.exit(1);
});
