const express = require("express");
const { MongoClient } = require("mongodb");
const router = express.Router();

// Fallback 연결 (req.app.locals.db가 없으면 직접 연결)
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { ignoreUndefined: true });

async function getDb(req) {
  // 1) app.locals.db가 있으면 그걸 사용
  if (req.app && req.app.locals && req.app.locals.db) {
    return req.app.locals.db;
  }
  // 2) 없으면 자체적으로 연결(싱글턴)
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  return client.db("eventpool"); // DB 이름
}

/**
 * GET /api/nationalities
 */
router.get("/", async (req, res) => {
  try {
    const db = await getDb(req);
    const list = await db
      .collection("nationalities")
      .find({})
      .sort({ name: 1 })
      .project({ _id: 0, name: 1 })
      .toArray();
    res.json(list.map(x => x.name));
  } catch (err) {
    console.error("GET /api/nationalities error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /api/nationalities  body: { name: string }
 */
router.post("/", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    const clean = name.trim();
    if (!clean) return res.status(400).json({ error: "name is empty" });

    const name_norm = clean.toLowerCase();
    const db = await getDb(req);
    await db.collection("nationalities").updateOne(
      { name_norm },
      { $setOnInsert: { name: clean, name_norm } },
      { upsert: true }
    );
    res.json({ ok: true, name: clean });
  } catch (err) {
    console.error("POST /api/nationalities error:", err);
    // 유니크 충돌 등은 ok 처리
    res.json({ ok: true, name: (req.body && req.body.name) || null });
  }
});

module.exports = router;
