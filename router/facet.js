// router/facet.js
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/* -------------------- helpers -------------------- */
const toArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const sanitizeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// $ifNull 체인 (aggregation 표현식)
const coalesce = (...fields) => {
  if (!fields || !fields.length) return null;
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
  },
  Job_Seekers: {
    groups: [
      { key: "Nationality", label: "Nationality" },
      { key: "Preferred_Work_Location", label: "Preferred Work Location" },
      { key: "Major", label: "Major" },
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

/* -------------------- 사전(Dictionary) 컬렉션 매핑 -------------------- */
/*  각 key는 화면 좌측 패싯 키, 값은 사전 컬렉션 이름
    - 컬렉션이 실제로 없으면 자동으로 스킵됩니다. */
const DICT_MAP = {
  Job_Seekers: {
    Nationality: "nationalities",
    Preferred_Work_Location: "work_locations",
    Major: "majors",
  },
  Job_Vacancies: {
    country: "countries",
    studentType: "student_types",
    teachingArea: "teaching_areas",
  },
  Online_Tutors: {
    Expertise: "tutor_expertise",
    Tutoring_Experience: "tutor_experience",
    Gender: "genders",
  },
};

/*  집계 결과 + 사전 컬렉션 병합
    - aggObj: $facet 전체 결과 객체(각 그룹은 by_<key> 배열로 들어있음)
    - hideZero: true면 0건 항목은 숨김 */
async function buildFacetsWithSeeds(db, klass, groups, aggObj, hideZero) {
  const out = {};
  for (const g of groups) {
    const byName = `by_${g.key}`;
    const live = ((aggObj && aggObj[byName]) || []).filter((x) => x && x._id);
    const dictColl = DICT_MAP[klass]?.[g.key];

    // 라이브 카운트를 Map으로
    const liveMap = new Map(live.map((x) => [x._id, x.c]));

    if (dictColl) {
      let seeds = [];
      try {
        // 사전 컬렉션이 없거나 비어있어도 에러 없이 넘어가도록
        const colls = await db.listCollections({ name: dictColl }).toArray();
        if (colls && colls.length) {
          seeds = await db
            .collection(dictColl)
            .find({}, { projection: { _id: 0, name: 1 } })
            .sort({ name: 1 })
            .toArray();
        }
      } catch (_) {
        // ignore
      }

      const merged = [];
      if (seeds.length) {
        // 1) 사전 우선
        for (const s of seeds) {
          const key = s.name;
          const c = liveMap.get(key) ?? 0;
          if (!hideZero || c > 0) merged.push({ _id: key, c });
          liveMap.delete(key);
        }
        // 2) 사전에 없지만 실제로 존재하는 값
        for (const [key, c] of liveMap) {
          if (!hideZero || c > 0) merged.push({ _id: key, c });
        }
      } else {
        // 사전이 없으면 라이브 그대로
        for (const [key, c] of liveMap) {
          if (!hideZero || c > 0) merged.push({ _id: key, c });
        }
      }

      merged.sort((a, b) => (b.c - a.c) || a._id.localeCompare(b._id));
      out[g.key] = merged;
    } else {
      // 사전 매핑이 없는 그룹은 라이브 그대로(옵션)
      let merged = live.slice();
      if (hideZero) merged = merged.filter((x) => x.c > 0);
      merged.sort((a, b) => (b.c - a.c) || a._id.localeCompare(b._id));
      out[g.key] = merged;
    }
  }
  return out;
}

/* -------------------- facet 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass;
    const spec = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const coll = spec.coll ? spec.coll(klass) : `${klass}_RDF`;

    const db = mongoose.connection.db;

    // 선택된 필터 파싱 (aliases 포함)
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
    const hideZero =
      req.query.hideZero === "1" ||
      req.query.hideZero === "true" ||
      req.query.hideZero === "on";

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

    /* -------------------- facet 스테이지 -------------------- */
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
              displayLabel: coalesce(
                "$_label",
                "$title",
                "$name",
                "$jobTitle",
                "$email",
                "Untitled"
              ),
              displayDescription: coalesce("$_description", "$description"),
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

    // 그룹별 카운트 파이프라인
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const allKeys = [g.key, ...(g.aliases || [])];
      const arr = [];

      arr.push({
        $set: { __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)) },
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
                    { $gt: [{ $strLenCP: { $ifNull: ["$__facet_value__", ""] } }, 0] },
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
      arr.push({ $limit: 400 });

      facetStages[name] = arr;
    }

    const pipeline = [{ $match: match }, { $facet: facetStages }];
    const [agg] = await db.collection(coll).aggregate(pipeline).toArray();

    const docs = (agg && agg.items) || [];
    const total = (agg && agg.count && agg.count[0] && agg.count[0].total) || 0;

    // 🔹 사전(Dictionary) 컬렉션과 병합하여 facets 구성
    const facets = await buildFacetsWithSeeds(db, klass, spec.groups, agg, hideZero);

    res.render("facet/list", {
      klass,
      docs,
      total,
      page,
      limit,
      q: qText,
      selected,
      facets,
      facetCfg: { groups: spec.groups },
      hideZero, // 템플릿 토글용
    });
  } catch (e) {
    console.error("[FACET] error:", e);
    next(e);
  }
});

module.exports = router;
