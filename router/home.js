// router/home.js  — Art Platform
"use strict";

const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");

const COLLS = {
  artworks:    "Artworks_RDF",
  artists:     "Artists_RDF",
  galleries:   "Galleries_RDF",
  exhibitions: "Exhibitions_RDF",
  auctions:    "Auctions_RDF",
};

function pickLabel(d) {
  return (d?._label || d?.title || d?.artworkTitle || d?.name || d?.artistName || "").toString();
}

/**
 * mongoose.connection.db 가 아직 undefined 일 수 있으므로
 * readyState 가 1(connected) 이 될 때까지 최대 10초 대기
 */
function getDb() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return Promise.resolve(mongoose.connection.db);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("MongoDB 연결 대기 시간 초과")), 10000);
    mongoose.connection.once("connected", () => {
      clearTimeout(timeout);
      resolve(mongoose.connection.db);
    });
    mongoose.connection.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── GET / ─────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();

    // 총 건수
    const [artCount, artistCount, galleryCount, exhibCount, auctionCount] =
      await Promise.all(
        Object.values(COLLS).map((c) => db.collection(c).countDocuments({}))
      );

    // 최신 작품 6건
    const recentArtworks = await db
      .collection(COLLS.artworks)
      .find({}, {
        projection: {
          _label: 1, title: 1, artworkTitle: 1,
          genre: 1, style: 1, medium: 1, material: 1,
          artistName: 1, creationYear: 1, imageUrl: 1,
          updatedAt: 1, createdAt: 1,
        },
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(6)
      .toArray();

    // 최신 작가 6건
    const recentArtists = await db
      .collection(COLLS.artists)
      .find({}, {
        projection: {
          _label: 1, artistName: 1, name: 1,
          country: 1, movement: 1, genre: 1, imageUrl: 1,
          updatedAt: 1, createdAt: 1,
        },
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(6)
      .toArray();

    // 장르 Top 8 (작품 기준)
    const topGenres = await db
      .collection(COLLS.artworks)
      .aggregate([
        { $match: { genre: { $nin: [null, ""] } } },
        { $group: { _id: "$genre", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ])
      .toArray();

    // 양식 Top 8
    const topStyles = await db
      .collection(COLLS.artworks)
      .aggregate([
        { $match: { style: { $nin: [null, ""] } } },
        { $group: { _id: "$style", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ])
      .toArray();

    res.render("home", {
      stats: { artCount, artistCount, galleryCount, exhibCount, auctionCount },
      recentArtworks: recentArtworks.map((d) => ({
        id:         d._id.toString(),
        title:      pickLabel(d),
        genre:      d.genre      || "",
        style:      d.style      || "",
        medium:     d.medium     || "",
        artistName: d.artistName || "",
        year:       d.creationYear || "",
        imageUrl:   d.imageUrl   || "",
      })),
      recentArtists: recentArtists.map((d) => ({
        id:       d._id.toString(),
        name:     pickLabel(d),
        country:  d.country  || "",
        movement: d.movement || "",
        genre:    Array.isArray(d.genre) ? d.genre.join(", ") : (d.genre || ""),
        imageUrl: d.imageUrl || "",
      })),
      topGenres,
      topStyles,
    });
  } catch (e) {
    console.error("[HOME] error:", e.message);
    // DB 연결 실패 시 빈 데이터로 fallback 렌더링
    res.render("home", {
      stats: { artCount: 0, artistCount: 0, galleryCount: 0, exhibCount: 0, auctionCount: 0 },
      recentArtworks: [],
      recentArtists:  [],
      topGenres:      [],
      topStyles:      [],
    });
  }
});

// ── GET /api/home/stats — JSON (카운트업 애니메이션용) ─────────
router.get("/api/home/stats", async (req, res) => {
  try {
    const db = await getDb();
    const [artCount, artistCount, galleryCount, exhibCount, auctionCount] =
      await Promise.all(
        Object.values(COLLS).map((c) => db.collection(c).countDocuments({}))
      );
    res.json({ artCount, artistCount, galleryCount, exhibCount, auctionCount });
  } catch (e) {
    console.error("[HOME/API] stats error:", e.message);
    res.status(500).json({ artCount: 0, artistCount: 0, galleryCount: 0, exhibCount: 0, auctionCount: 0 });
  }
});

module.exports = router;
