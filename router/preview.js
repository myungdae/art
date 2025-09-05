// router/preview.js  (preview-only page for nationality widget)
"use strict";

const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { ignoreUndefined: true });

async function getDb(req) {
  // mongoose가 이미 연결되어 있다면 그걸 써도 됨. 없으면 직접 연결.
  if (req.app?.locals?.db) return req.app.locals.db;
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  return client.db("eventpool");
}

async function fetchNationalities(req) {
  const db = await getDb(req);
  const list = await db
    .collection("nationalities")
    .find({})
    .sort({ name: 1 })
    .project({ _id: 0, name: 1 })
    .toArray();
  return list.map(x => x.name);
}

// GET /preview/nationality  → 보기 전용 데모 페이지
router.get("/nationality", async (req, res, next) => {
  try {
    const nationalities = await fetchNationalities(req);
    res.render("preview/nationality", {
      nationalities,
      pageTitle: "Nationality Preview"
    });
  } catch (e) { next(e); }
});

module.exports = router;
