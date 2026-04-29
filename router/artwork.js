/**
 * router/artwork.js
 * 작품(Artworks_RDF) 등록 / 수정 API
 *
 * POST /artwork          — 새 작품 등록
 * PUT  /artwork/:id      — 기존 작품 수정
 * GET  /artwork/:id/color-refresh  — 색상만 재추출 (관리자용)
 *
 * 공통 동작:
 *   1. 요청 body 검증
 *   2. Artworks_RDF 컬렉션에 저장
 *   3. imageUrl 이 있으면 extractMainColor() 비동기 실행 → mainColor 자동 저장
 */
"use strict";

const express  = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const { extractMainColor } = require("../utils/colorExtractor");

const router = express.Router();

/* ── helpers ── */
function getDb() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return Promise.resolve(mongoose.connection.db);
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("MongoDB 연결 대기 시간 초과")), 10000);
    mongoose.connection.once("connected", () => { clearTimeout(t); resolve(mongoose.connection.db); });
    mongoose.connection.once("error",     (e) => { clearTimeout(t); reject(e); });
  });
}

/** 저장 후 비동기로 색상 추출 → DB 업데이트 (응답 지연 없음) */
function scheduleColorExtract(col, docId, imageUrl) {
  if (!imageUrl) return;
  setImmediate(async () => {
    try {
      const color = await extractMainColor(imageUrl);
      if (color) {
        await col.updateOne({ _id: docId }, { $set: { mainColor: color } });
        console.log(`🎨 [colorExtract] _id=${docId} → ${color}`);
      } else {
        console.warn(`⚠️  [colorExtract] 색상 추출 실패: _id=${docId}`);
      }
    } catch (e) {
      console.error(`🔴 [colorExtract] 에러: ${e.message}`);
    }
  });
}

/** body → DB 저장용 document 변환 */
function buildDoc(body, isNew = true) {
  const now = new Date();
  const doc = {
    _class:       "Artworks",
    _label:       (body.title || body.artworkTitle || "").trim(),
    title:        (body.title || "").trim(),
    artworkTitle: (body.artworkTitle || body.title || "").trim(),
    artistName:   (body.artistName || "").trim(),
    genre:        (body.genre || "").trim(),
    style:        (body.style || "").trim(),
    medium:       (body.medium || "").trim(),
    material:     body.material
                    ? (Array.isArray(body.material) ? body.material : [body.material])
                    : [],
    theme:        body.theme
                    ? (Array.isArray(body.theme) ? body.theme : [body.theme])
                    : [],
    movement:     (body.movement || "").trim(),
    country:      (body.country || "").trim(),
    creationYear: (body.creationYear || "").trim(),
    imageUrl:     (body.imageUrl || "").trim(),
    priceValue:   body.priceValue ? Number(body.priceValue) : undefined,
    _description: (body.description || body._description || "").trim(),
    description:  (body.description || body._description || "").trim(),
    orientation:  (body.orientation || "").trim(),
    size:         (body.size || "").trim(),
    updatedAt:    now,
  };

  // mainColor: body에 직접 있으면 사용, 없으면 imageUrl에서 추출 예정
  if (body.mainColor) doc.mainColor = body.mainColor.trim();

  // 빈 문자열 필드 제거 (선택)
  for (const k of Object.keys(doc)) {
    if (doc[k] === "" || doc[k] === undefined) delete doc[k];
    if (Array.isArray(doc[k]) && doc[k].length === 0) delete doc[k];
  }

  if (isNew) doc.createdAt = now;
  return doc;
}

/* ──────────────────────────────────────────────────────────
   POST /artwork
   새 작품 등록
────────────────────────────────────────────────────────── */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const label = (body.title || body.artworkTitle || "").trim();
    if (!label) {
      return res.status(400).json({ ok: false, error: "title 또는 artworkTitle 은 필수입니다." });
    }

    const db  = await getDb();
    const col = db.collection("Artworks_RDF");

    const doc    = buildDoc(body, true);
    const result = await col.insertOne(doc);
    const newId  = result.insertedId;

    // ── 이미지 있으면 색상 자동 추출 (응답 먼저, 추출은 background)
    scheduleColorExtract(col, newId, doc.imageUrl);

    return res.status(201).json({
      ok:    true,
      _id:   newId,
      color: doc.mainColor || "(추출 중...)",
      msg:   "작품이 등록되었습니다. 색상은 자동으로 추출됩니다.",
    });
  } catch (e) {
    next(e);
  }
});

/* ──────────────────────────────────────────────────────────
   PUT /artwork/:id
   기존 작품 수정
────────────────────────────────────────────────────────── */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "유효하지 않은 ID입니다." });
    }

    const db  = await getDb();
    const col = db.collection("Artworks_RDF");

    const body    = req.body || {};
    const setDoc  = buildDoc(body, false);      // isNew=false → createdAt 포함 안 함
    const oid     = new ObjectId(id);

    // imageUrl 이 변경되면 mainColor 재추출 (기존 값 삭제 후 재추출)
    const prev = await col.findOne({ _id: oid }, { projection: { imageUrl: 1, mainColor: 1 } });
    const imageChanged = prev && prev.imageUrl !== setDoc.imageUrl && setDoc.imageUrl;
    if (imageChanged) {
      setDoc.mainColor = undefined;  // 일단 비워두고 background에서 재설정
      delete setDoc.mainColor;
    }

    const result = await col.updateOne({ _id: oid }, { $set: setDoc });
    if (result.matchedCount === 0) {
      return res.status(404).json({ ok: false, error: "해당 작품을 찾을 수 없습니다." });
    }

    // imageUrl 변경 시 색상 재추출
    if (imageChanged) {
      scheduleColorExtract(col, oid, setDoc.imageUrl);
    }

    return res.json({
      ok:      true,
      _id:     id,
      updated: result.modifiedCount,
      msg:     imageChanged
               ? "작품이 수정되었습니다. 색상을 재추출합니다."
               : "작품이 수정되었습니다.",
    });
  } catch (e) {
    next(e);
  }
});

/* ──────────────────────────────────────────────────────────
   GET /artwork/:id/color-refresh
   색상만 강제 재추출 (관리자 / 배치 작업용)
────────────────────────────────────────────────────────── */
router.get("/:id/color-refresh", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "유효하지 않은 ID입니다." });
    }

    const db  = await getDb();
    const col = db.collection("Artworks_RDF");
    const doc = await col.findOne({ _id: new ObjectId(id) }, { projection: { imageUrl: 1, mainColor: 1 } });

    if (!doc) return res.status(404).json({ ok: false, error: "작품을 찾을 수 없습니다." });
    if (!doc.imageUrl) return res.status(400).json({ ok: false, error: "imageUrl 이 없습니다." });

    const color = await extractMainColor(doc.imageUrl);
    if (color) {
      await col.updateOne({ _id: doc._id }, { $set: { mainColor: color } });
      return res.json({ ok: true, _id: id, mainColor: color });
    } else {
      return res.status(422).json({ ok: false, error: "색상 추출에 실패했습니다." });
    }
  } catch (e) {
    next(e);
  }
});

module.exports = router;
