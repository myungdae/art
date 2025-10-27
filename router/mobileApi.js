// router/mobileApi.js - JSON API for Flutter Mobile App
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

/* -------------------- helpers -------------------- */
const toArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const sanitizeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const coalesce = (...fields) => {
  if (fields.length === 0) return null;
  return fields.reduceRight((acc, cur) => ({ $ifNull: [cur, acc] }));
};

/* -------------------- 클래스별 패싯 설정 -------------------- */
const FACET_MAP = {
  Job_Vacancies: {
    groups: [
      { key: "country", aliases: ["Country"], label: "Country" },
      { key: "studentType", aliases: ["StudentType"], label: "Student Type" },
      {
        key: "teachingArea",
        aliases: ["Teaching_Area"],
        label: "Teaching Area",
        array: true,
      },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
  },
  Job_Seekers: {
    groups: [
      { key: "Nationality", aliases: ["nationality"], label: "Nationality" },
      { key: "Preferred_Work_Location", aliases: ["preferredWorkLocation", "preferred_work_location"], label: "Preferred Work Location" },
      { key: "Major", aliases: ["major"], label: "Major" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
  },
  Online_Tutors: {
    groups: [
      { key: "Expertise", label: "Expertise", array: true },
      { key: "Tutoring_Experience", label: "Tutoring Experience" },
      { key: "Gender", label: "Gender" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
  },
};

/* -------------------- JSON API 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass;
    const spec = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const coll = spec.coll ? spec.coll(klass) : `${klass}_RDF`;

    const db = mongoose.connection.db;

    // 선택된 필터 파싱
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
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * limit;
    const sortMode = req.query.sort || "recent";

    /* -------------------- match -------------------- */
    const match = { _class: klass };

    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), "i");
      const fields = spec.searchFields || ["_label", "title", "_description"];
      match.$or = fields.map((f) => ({ [f]: rx }));
    }

    // 필터 반영
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

    /* -------------------- 정렬 -------------------- */
    let sortStage;
    if (sortMode === "oldest") {
      sortStage = [
        {
          $addFields: {
            _s_date: { $ifNull: ["$datePosted", "$updatedAt"] },
          },
        },
        { $sort: { _s_date: 1, _id: 1 } },
      ];
    } else if (sortMode === "alpha-asc") {
      sortStage = [
        {
          $addFields: {
            _s_label: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", ""),
          },
        },
        { $sort: { _s_label: 1, _id: 1 } },
      ];
    } else if (sortMode === "alpha-desc") {
      sortStage = [
        {
          $addFields: {
            _s_label: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", ""),
          },
        },
        { $sort: { _s_label: -1, _id: -1 } },
      ];
    } else {
      // recent (default)
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
        {
          $project: Object.assign(
            {
              _id: 1,
              "@id": 1,
              _label: 1,
              title: 1,
              _description: 1,
              description: 1,
              datePosted: 1,
              updatedAt: 1,
              createdAt: 1,
            },
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

    // Facet counts
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const arr = [];

      const allKeys = [g.key, ...(g.aliases || [])];
      arr.push({
        $set: {
          __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)),
        },
      });

      if (g.array) {
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
                    ["$__facet_value__"],
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
      arr.push({ $limit: 100 });

      facetStages[name] = arr;
    }

    const pipeline = [{ $match: match }, { $facet: facetStages }];
    const [agg] = await db.collection(coll).aggregate(pipeline).toArray();

    const items = (agg && agg.items) || [];
    const total = (agg && agg.count && agg.count[0] && agg.count[0].total) || 0;

    // Facets for filters
    const facets = {};
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      facets[g.key] = {
        label: g.label,
        options: ((agg && agg[name]) || [])
          .filter((x) => x._id)
          .map((x) => ({ value: x._id, count: x.c })),
      };
    }

    // Return JSON
    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      facets,
      query: qText,
      selected,
    });
  } catch (e) {
    console.error("[MOBILE API] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
