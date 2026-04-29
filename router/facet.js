// router/facet.js
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

/* -------------------- helpers -------------------- */
const toArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const sanitizeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// $ifNull 체인 유틸 (aggregation 표현식)
const coalesce = (...fields) => {
  // 마지막이 리터럴일 수 있음
  if (fields.length === 0) return null;
  return fields.reduceRight((acc, cur) => ({ $ifNull: [cur, acc] }));
};

/* -------------------- 클래스별 패싯 설정 -------------------- */
/** 주의:
 *  - key: 컬렉션에 저장된 기본 필드명 (RDF 기준)
 *  - aliases: 과거/다른 경로에서 들어온 동일 의미의 필드명(소문자/대문자 혼용 등)
 *  - array: 배열 필드이면 true (unwind 필요)
 */
const FACET_MAP = {
  // ── 작품 ─────────────────────────────────────────────────────────────────
  Artworks: {
    groups: [
      { key: "genre",    aliases: ["Genre"],    label: "장르",   labelEn: "Genre",    array: false },
      { key: "style",    aliases: ["Style"],    label: "양식",   labelEn: "Style",    array: false },
      { key: "medium",   aliases: ["Medium"],   label: "매체",   labelEn: "Medium",   array: false },
      { key: "material", aliases: ["Material"], label: "재료",   labelEn: "Material", array: true  },
      { key: "theme",    aliases: ["Theme"],    label: "테마",   labelEn: "Theme",    array: true  },
      { key: "movement", aliases: ["Movement"], label: "운동",   labelEn: "Movement", array: false },
    ],
    searchFields: ["_label", "title", "artworkTitle", "artistName", "_description", "description"],
    coll: () => "Artworks_RDF",
    sortDefault: "alpha-asc",
  },

  // ── 작가 ─────────────────────────────────────────────────────────────────
  Artists: {
    groups: [
      { key: "country",  aliases: ["Artist_Country"], label: "국가",   labelEn: "Country",   array: false },
      { key: "movement", aliases: ["Movement"],        label: "운동",   labelEn: "Movement",  array: false },
      { key: "genre",    aliases: ["Genre"],           label: "장르",   labelEn: "Genre",     array: true  },
    ],
    searchFields: ["_label", "artistName", "name", "title", "_description"],
    coll: () => "Artists_RDF",
    sortDefault: "alpha-asc",
  },

  // ── 갤러리 ────────────────────────────────────────────────────────────────
  Galleries: {
    groups: [
      { key: "country", aliases: ["Country"], label: "국가",   labelEn: "Country",  array: false },
      { key: "genre",   aliases: ["Genre"],   label: "전문장르", labelEn: "Genre",   array: true  },
    ],
    searchFields: ["_label", "name", "title", "_description", "description"],
    coll: () => "Galleries_RDF",
    sortDefault: "alpha-asc",
  },

  // ── 전시 ─────────────────────────────────────────────────────────────────
  Exhibitions: {
    groups: [
      { key: "genre",   aliases: ["Genre"],   label: "장르",   labelEn: "Genre",   array: true  },
      { key: "country", aliases: ["Country"], label: "국가",   labelEn: "Country", array: false },
    ],
    searchFields: ["_label", "name", "title", "_description", "description"],
    coll: () => "Exhibitions_RDF",
    sortDefault: "recent",
  },

  // ── 경매 ─────────────────────────────────────────────────────────────────
  Auctions: {
    groups: [
      { key: "auctionHouse", aliases: ["AuctionHouse"], label: "경매사",  labelEn: "Auction House", array: false },
      { key: "genre",        aliases: ["Genre"],        label: "장르",    labelEn: "Genre",         array: false },
    ],
    searchFields: ["_label", "title", "artworkTitle", "artistName", "_description"],
    coll: () => "Auctions_RDF",
    sortDefault: "recent",
  },
};

/* -------------------- facet 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass; // ex) "Artworks"
    const spec = FACET_MAP[klass] || FACET_MAP.Artworks;
    const coll = spec.coll ? spec.coll(klass) : `${klass}_RDF`;

    const db = mongoose.connection.db;

    // 선택된 필터 파싱 (클래스별 key 사용; aliases도 허용)
    const selected = {};
    for (const g of spec.groups) {
      const allKeys = [g.key, ...(g.aliases || [])];
      let vals = [];
      for (const k of allKeys) {
        vals = vals.concat(toArray(req.query[k]));
      }
      selected[g.key] = Array.from(new Set(vals.filter(Boolean)));
    }

    const qText = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 5000);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * limit;
    const sortMode = req.query.sort || "recent"; // recent, oldest, alpha-asc, alpha-desc

    /* -------------------- match -------------------- */
    const match = { _class: klass };

    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), "i");
      const fields = spec.searchFields || ["_label", "title", "_description"];
      match.$or = fields.map((f) => ({ [f]: rx }));
    }

    // 필터 반영 (aliases 포함하여 OR)
    for (const g of spec.groups) {
      const vals = selected[g.key];
      if (vals && vals.length) {
        const allKeys = [g.key, ...(g.aliases || [])];
        match.$and = match.$and || [];
        match.$and.push({
          $or: allKeys.map((k) => ({ [k]: { $in: vals } })),
        });
      }
    }

    /* -------------------- facet 스테이지 -------------------- */
    // 정렬 방식 결정
    let sortStage;
    if (sortMode === "oldest") {
      // 오래된 순
      sortStage = [
        {
          $addFields: {
            _s_date: { $ifNull: ["$datePosted", "$updatedAt"] },
          },
        },
        { $sort: { _s_date: 1, _id: 1 } },
      ];
    } else if (sortMode === "alpha-asc") {
      // 알파벳 오름차순 (A-Z)
      sortStage = [
        {
          $addFields: {
            _s_label: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", ""),
          },
        },
        { $sort: { _s_label: 1, _id: 1 } },
      ];
    } else if (sortMode === "alpha-desc") {
      // 알파벳 내림차순 (Z-A)
      sortStage = [
        {
          $addFields: {
            _s_label: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", ""),
          },
        },
        { $sort: { _s_label: -1, _id: -1 } },
      ];
    } else {
      // 기본: 최신 우선 (recent)
      sortStage = [
        {
          $addFields: {
            _s_date: { $ifNull: ["$datePosted", "$updatedAt"] },
          },
        },
        { $sort: { _s_date: -1, _id: -1 } },
      ];
    }

    const facetStages = {
      items: [
        ...sortStage,
        { $skip: skip },
        { $limit: limit },

        // 표시용 라벨/설명 생성 + 결과 카드에 쓸 필드 project
        {
          $project: Object.assign(
            {
              _id: 1,
              "@id": 1,

              // ✅ 여기서 최종 표시 라벨을 확정합니다.
              displayLabel: coalesce(
                "$_label",
                "$title",
                "$name",
                "$jobTitle",
                "$email",
                "Untitled"
              ),

              // (선택) 설명도 coalesce
              displayDescription: coalesce("$_description", "$description"),

              // 원본도 같이 전달(디버깅/호환)
              _label: 1,
              title: 1,
              _description: 1,
              description: 1,

              datePosted: 1,
              updatedAt: 1,
            },
            // 결과 카드에 쓸 수 있도록 모든 facet key도 project
            Object.fromEntries(
              spec.groups.flatMap((g) => {
                const base = [[g.key, 1]];
                const ali = (g.aliases || []).map((a) => [a, 1]);
                return base.concat(ali);
              })
            )
          ),
        },
      ],
      count: [{ $count: "total" }],
    };

    // 그룹별 카운트 서브파이프라인
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const arr = [];

      // 배열인 경우 언와인드(aliases도 모두 고려)
      const allKeys = [g.key, ...(g.aliases || [])];

      // 하나의 공통 가상 필드로 묶기
      arr.push({
        $set: {
          __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)),
        },
      });

      if (g.array) {
        // __facet_value__ 가 배열일 수도/아닐 수도 있으므로, 배열이 아니면 배열로 감싸기
        arr.push({
          $set: {
            __facet_list__: {
              $cond: [
                { $isArray: "$__facet_value__" },
                "$__facet_value__",
                {
                  $cond: [
                    {
                      $gt: [
                        { $strLenCP: { $ifNull: ["$__facet_value__", ""] } },
                        0,
                      ],
                    },
                    [" $__facet_value__ "],
                    [],
                  ],
                },
              ],
            },
          },
        });
        arr.push({
          $unwind: {
            path: "$__facet_list__",
            preserveNullAndEmptyArrays: false,
          },
        });
        arr.push({ $match: { __facet_list__: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$__facet_list__", c: { $sum: 1 } } });
      } else {
        arr.push({ $match: { __facet_value__: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$__facet_value__", c: { $sum: 1 } } });
      }

      arr.push({ $sort: { c: -1, _id: 1 } });
      arr.push({ $limit: 400 });

      facetStages[name] = arr;
    }

    const pipeline = [{ $match: match }, { $facet: facetStages }];

    const [agg] = await db.collection(coll).aggregate(pipeline).toArray();

    const docs = (agg && agg.items) || [];
    const total = (agg && agg.count && agg.count[0] && agg.count[0].total) || 0;

    // 템플릿으로 넘길 facets: { [key]: [{_id, c}, ...] }
    const facets = {};
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      facets[g.key] = ((agg && agg[name]) || []).filter((x) => x._id);
    }

    res.render("facet/list", {
      klass,
      docs,
      total,
      page,
      limit,
      q: qText,
      sort: sortMode,
      selected,
      facets,
      facetCfg: { groups: spec.groups }, // Pug에서 보여줄 그룹 메타
    });
  } catch (e) {
    console.error("[FACET] error:", e);
    next(e);
  }
});

module.exports = router;
