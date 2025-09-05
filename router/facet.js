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
  if (fields.length === 0) return null;
  return fields.reduceRight((acc, cur) => ({ $ifNull: [cur, acc] }));
};

/* -------------------- 클래스별 패싯 설정 -------------------- */
const FACET_MAP = {
  Job_Vacancies: {
    groups: [
      { key: "country", aliases: ["Country"], label: "Country" },
      { key: "studentType", aliases: ["StudentType"], label: "Student Type" },
      { key: "teachingArea", aliases: ["Teaching_Area"], label: "Teaching Area", array: true },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
    title: "Job Vacancies",
  },
  Job_Seekers: {
    groups: [
      { key: "Nationality", label: "Nationality" },
      { key: "Preferred_Work_Location", label: "Preferred Work Location" },
      { key: "Major", label: "Major" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
    title: "Job Seekers",
  },
  Online_Tutors: {
    groups: [
      { key: "Expertise", label: "Expertise", array: true },
      { key: "Tutoring_Experience", label: "Tutoring Experience" },
      { key: "Gender", label: "Gender" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
    coll: (klass) => `${klass}_RDF`,
    title: "Online Tutors",
  },
};

/* -------- (NEW) Job_Seekers 국적 50+ 머지: master + 실제 사용 카운트 -------- */
async function buildNationalityFacetMerged() {
  const db = mongoose.connection.db;

  // 실제 사용 값 정규화하여 집계
  const used = await db
    .collection("Job_Seekers_RDF")
    .aggregate([
      { $match: { Nationality: { $type: "string" } } },
      { $project: { t: { $trim: { input: "$Nationality" } } } },
      { $match: { t: { $nin: [null, ""] } } },
      { $addFields: { L: { $strLenCP: "$t" } } },
      {
        $project: {
          n: {
            $cond: [
              { $eq: ["$L", 0] },
              null,
              {
                $concat: [
                  { $toUpper: { $substrCP: ["$t", 0, 1] } },
                  { $toLower: { $substrCP: ["$t", 1, { $max: [{ $subtract: ["$L", 1] }, 0] }] } },
                ],
              },
            ],
          },
        },
      },
      { $match: { n: { $ne: null } } },
      { $group: { _id: "$n", count: { $sum: 1 } } },
    ])
    .toArray();

  const countMap = {};
  for (const r of used) countMap[r._id] = r.count;

  // 마스터 리스트
  const master = await db
    .collection("nationalities")
    .find({}, { projection: { _id: 0, name: 1 } })
    .sort({ name: 1 })
    .toArray();

  const merged = master.map((m) => ({ _id: m.name, count: countMap[m.name] || 0 }));

  // 마스터에 없는 과거 값 보존
  for (const k of Object.keys(countMap)) {
    if (!merged.find((x) => x._id === k)) merged.push({ _id: k, count: countMap[k] });
  }

  // 사용중 우선, 그 다음 알파벳
  merged.sort((a, b) => (b.count > 0) - (a.count > 0) || a._id.localeCompare(b._id));
  return merged;
}

/* -------------------- facet 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass;
    const spec = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const coll = spec.coll ? spec.coll(klass) : `${klass}_RDF`;
    const db = mongoose.connection.db;

    const hideZero = req.query.hideZero === "1";

    // 선택 필터 파싱
    const selected = {};
    for (const g of spec.groups) {
      const allKeys = [g.key, ...(g.aliases || [])];
      let vals = [];
      for (const k of allKeys) vals = vals.concat(toArray(req.query[k]));
      selected[g.key] = Array.from(new Set(vals.filter(Boolean)));
    }

    const qText = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 5000);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * limit;

    /* -------------------- match -------------------- */
    const match = { _class: klass };

    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), "i");
      const fields = spec.searchFields || ["_label", "title", "_description"];
      match.$or = fields.map((f) => ({ [f]: rx }));
    }

    for (const g of spec.groups) {
      const vals = selected[g.key];
      if (vals && vals.length) {
        const allKeys = [g.key, ...(g.aliases || [])];
        match.$and = match.$and || [];
        match.$and.push({ $or: allKeys.map((k) => ({ [k]: { $in: vals } })) });
      }
    }

    /* -------------------- facet 파이프라인 -------------------- */
    const facetStages = {
      items: [
        { $addFields: { _s_date: { $ifNull: ["$datePosted", "$updatedAt"] } } },
        { $sort: { _s_date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: Object.assign(
            {
              _id: 1,
              "@id": 1,
              displayLabel: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", "Untitled"),
              displayDescription: coalesce("$_description", "$description"),
              _label: 1, title: 1, _description: 1, description: 1,
              datePosted: 1, updatedAt: 1,
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

    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const arr = [];
      const allKeys = [g.key, ...(g.aliases || [])];

      arr.push({ $set: { __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)) } });

      if (g.array) {
        arr.push({
          $set: {
            __facet_list__: {
              $cond: [
                { $isArray: "$__facet_value__" },
                "$__facet_value__",
                {
                  $cond: [
                    { $gt: [{ $strLenCP: { $ifNull: ["$__facet_value__", ""] } }, 0] },
                    ["$__facet_value__"],
                    [],
                  ],
                },
              ],
            },
          },
        });
        arr.push({ $unwind: { path: "$__facet_list__", preserveNullAndEmptyArrays: false } });
        arr.push({ $match: { __facet_list__: { $nin: [null, ""] } } });
        arr.push({ $group: { _id: "$__facet_list__", c: { $sum: 1 } } });
      } else {
        arr.push({ $match: { __facet_value__: { $nin: [null, ""] } } });
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

    // 기본 카운트 -> facets 사전
    const facetsRaw = {};
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      let arr = ((agg && agg[name]) || []).filter((x) => x._id);
      if (hideZero) arr = arr.filter((x) => (x.c || 0) > 0);
      facetsRaw[g.key] = arr;
    }

    // (NEW) Job_Seekers 국적 50+로 교체
    if (klass === "Job_Seekers") {
      let merged = await buildNationalityFacetMerged(); // { _id, count }
      if (hideZero) merged = merged.filter((x) => x.count > 0);
      facetsRaw["Nationality"] = merged.map((x) => ({ _id: x._id, c: x.count }));
    }

    // 뷰가 기대하는 filters 포맷으로 변환
    const filters = (spec.groups || []).map((g) => ({
      display: g.label || g.key,
      name: g.key,
      options: (facetsRaw[g.key] || []).map((x) => ({
        value: x._id,
        label: x._id,
        count: x.c || 0,
      })),
    }));

    // 뷰: facet/facet.pug (기존 파일)
    res.render("facet/facet", {
      klass,
      titleText: spec.title || klass.replace("_", " "),
      q: qText,
      total,
      page,
      limit,
      hideZero,
      selected,
      filters,         // ← 사이드 필터
      data: docs,      // ← 리스트 카드
    });
  } catch (e) {
    console.error("[FACET] error:", e);
    next(e);
  }
});

module.exports = router;
