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

// 정렬/키 통합 유틸
const keyStr = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // 객체일 경우 name/code/_id 등을 우선 사용
  if (typeof v === "object") {
    if (v.name) return String(v.name);
    if (v.code) return String(v.code);
    if (v._id) return keyStr(v._id);
  }
  try { return String(v); } catch { return ""; }
};
const safeSortByCountThenKey = (a, b) =>
  (Number(b.c || 0) - Number(a.c || 0)) ||
  keyStr(a._id).localeCompare(keyStr(b._id));

/* -------------------- 클래스별 패싯 설정 -------------------- */
const FACET_MAP = {
  Job_Vacancies: {
    groups: [
      { key: "country", aliases: ["Country", "country.name", "country.code"], label: "Country" },
      { key: "studentType", aliases: ["StudentType"], label: "Student Type" },
      { key: "teachingArea", aliases: ["Teaching_Area"], label: "Teaching Area", array: true },
    ],
    searchFields: ["_label", "title", "_description", "description"],
  },
  Job_Seekers: {
    groups: [
      { key: "Nationality", label: "Nationality" },
      { key: "Preferred_Work_Location", label: "Preferred Work Location" },
      { key: "Major", label: "Major" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
  },
  Online_Tutors: {
    groups: [
      { key: "Expertise", label: "Expertise", array: true },
      { key: "Tutoring_Experience", label: "Tutoring Experience" },
      { key: "Gender", label: "Gender" },
    ],
    searchFields: ["_label", "title", "_description", "description"],
  },
};

/* -------------------- 사전(Dictionary) 컬렉션 매핑 -------------------- */
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

/*  집계 결과 + 사전 컬렉션 병합 (정렬 안전화) */
async function buildFacetsWithSeeds(db, klass, groups, aggObj, hideZero) {
  const out = {};
  for (const g of groups) {
    const byName = `by_${g.key}`;

    // 라이브 결과를 먼저 문자열 키로 정규화
    const liveRaw = ((aggObj && aggObj[byName]) || []).filter((x) => x && x._id);
    const live = liveRaw.map((x) => ({ _id: keyStr(x._id), c: Number(x.c || 0) }));

    const dictColl = DICT_MAP[klass]?.[g.key];

    // Map은 항상 문자열 키를 사용
    const liveMap = new Map(live.map((x) => [x._id, x.c]));

    if (dictColl) {
      let seeds = [];
      try {
        const colls = await db.listCollections({ name: dictColl }).toArray();
        if (colls && colls.length) {
          seeds = await db
            .collection(dictColl)
            .find({}, { projection: { _id: 0, name: 1 } })
            .sort({ name: 1 })
            .toArray();
        }
      } catch (_) {}

      const merged = [];
      if (seeds.length) {
        for (const s of seeds) {
          const key = keyStr(s && s.name);
          if (!key) continue;
          const c = Number(liveMap.get(key) ?? 0);
          if (!hideZero || c > 0) merged.push({ _id: key, c });
          liveMap.delete(key);
        }
        for (const [key, c] of liveMap) {
          if (!hideZero || c > 0) merged.push({ _id: keyStr(key), c: Number(c || 0) });
        }
      } else {
        for (const [key, c] of liveMap) {
          if (!hideZero || c > 0) merged.push({ _id: keyStr(key), c: Number(c || 0) });
        }
      }

      merged.sort(safeSortByCountThenKey);
      out[g.key] = merged;
    } else {
      // dict 없이 라이브만 사용하는 경우도 문자열 키로 정렬
      let merged = live.slice();
      if (hideZero) merged = merged.filter((x) => Number(x.c || 0) > 0);
      merged.sort(safeSortByCountThenKey);
      out[g.key] = merged;
    }
  }
  return out;
}

/* -------------------- 데이터 소스 선택 -------------------- */
/**
 * 중요: Job_Vacancies 는 무조건 resources 사용
 *  - 폼 저장이 resources 로 들어가기 때문
 * 그 외 클래스를 위해서만 resources → rdf → direct 순으로 폴백
 */
async function pickSource(db, klass) {
  if (klass === "Job_Vacancies") {
    return { coll: "resources", style: "resources", baseMatch: { type: "Job_Vacancies" } };
  }

  const rdfName = `${klass}_RDF`;

  // 1) resources
  try {
    const exists = await db.listCollections({ name: "resources" }).toArray();
    if (exists.length) {
      const one = await db.collection("resources").findOne({ type: klass }, { projection: { _id: 1 } });
      if (one) return { coll: "resources", style: "resources", baseMatch: { type: klass } };
    }
  } catch {}

  // 2) rdf
  try {
    const exists = await db.listCollections({ name: rdfName }).toArray();
    if (exists.length) {
      const one = await db.collection(rdfName).findOne({ _class: klass }, { projection: { _id: 1 } });
      if (one) return { coll: rdfName, style: "rdf", baseMatch: { _class: klass } };
    }
  } catch {}

  // 3) direct
  try {
    const exists = await db.listCollections({ name: klass }).toArray();
    if (exists.length) {
      const one = await db.collection(klass).findOne({}, { projection: { _id: 1 } });
      if (one) return { coll: klass, style: "direct", baseMatch: {} };
    }
  } catch {}

  // fallback
  return { coll: rdfName, style: "rdf", baseMatch: { _class: klass } };
}

/* -------------------- country → countryStr 정규화 스테이지 -------------------- */
const addCountryStrStage = {
  $addFields: {
    countryStr: {
      $let: {
        vars: { c: coalesce("$country", "$Country") },
        in: {
          $switch: {
            branches: [
              { case: { $eq: [{ $type: "$$c" }, "string"] }, then: "$$c" },
              {
                case: { $eq: [{ $type: "$$c" }, "object"] },
                then: { $ifNull: ["$$c.name", { $ifNull: ["$$c.code", ""] }] },
              },
            ],
            default: "",
          },
        },
      },
    },
  },
};

/* -------------------- facet 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass;
    const spec = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const db = mongoose.connection.db;

    // 데이터 소스 선택 (Job_Vacancies는 resources 고정)
    const src = await pickSource(db, klass);
    res.set("X-Facet-Source", `${src.style}:${src.coll}`);

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

    /* -------------------- match (pre) -------------------- */
    const preMatch = { ...(src.baseMatch || {}) };

    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), "i");
      const fields = spec.searchFields || ["_label", "title", "_description"];
      preMatch.$or = fields.map((f) => ({ [f]: rx }));
    }

    // country는 countryStr로만 필터 (preMatch에는 넣지 않음)
    for (const g of spec.groups) {
      if (g.key === "country") continue;
      const vals = selected[g.key];
      if (vals && vals.length) {
        const allKeys = [g.key, ...(g.aliases || [])];
        preMatch.$and = preMatch.$and || [];
        preMatch.$and.push({ $or: allKeys.map((k) => ({ [k]: { $in: vals } })) });
      }
    }

    /* -------------------- facet 스테이지 -------------------- */

    // country 전용 post-match
    const postCountryMatchStages =
      selected.country && selected.country.length
        ? [{ $match: { countryStr: { $in: selected.country } } }]
        : [];

    const commonInnerStages = [addCountryStrStage, ...postCountryMatchStages];

    // 리스트 표시 필드
    const itemProject = {
      _id: 1,
      "@id": 1,
      displayLabel: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", "Untitled"),
      displayDescription: coalesce("$_description", "$description"),
      _label: 1,
      title: 1,
      _description: 1,
      description: 1,
      country: "$countryStr",
      date: 1,
      datePosted: 1,
      updatedAt: 1,
      studentType: 1,
      teachingArea: 1,
    };
    for (const g of spec.groups) {
      if (g.key === "country") {
        (g.aliases || [])
          .filter((a) => a && !a.includes("."))
          .forEach((a) => (itemProject[a] = 1));
        continue;
      }
      (g.aliases || [])
        .filter((a) => a && !a.includes("."))
        .forEach((a) => (itemProject[a] = 1));
    }

    const facetStages = {
      items: [
        ...commonInnerStages,
        { $addFields: { _s_date: coalesce("$datePosted", "$date", "$updatedAt", "$createdAt") } },
        { $sort: { _s_date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: itemProject },
      ],
      count: [...commonInnerStages, { $count: "total" }],
    };

    // 좌측 패싯
    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const allKeys = [g.key, ...(g.aliases || [])];
      const arr = [...commonInnerStages];

      if (g.key === "country") {
        arr.push({ $match: { countryStr: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$countryStr", c: { $sum: 1 } } });
      } else if (g.array) {
        arr.push({ $set: { __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)) } });
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
        arr.push({ $match: { __facet_list__: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$__facet_list__", c: { $sum: 1 } } });
      } else {
        arr.push({ $set: { __facet_value__: coalesce(...allKeys.map((k) => `$${k}`)) } });
        arr.push({ $match: { __facet_value__: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$__facet_value__", c: { $sum: 1 } } });
      }

      arr.push({ $sort: { c: -1, _id: 1 } }); // 1차 정렬은 서버에서, 키 충돌은 JS에서 대비
      arr.push({ $limit: 400 });

      facetStages[name] = arr;
    }

    const pipeline = [{ $match: preMatch }, { $facet: facetStages }];
    const [agg] = await db.collection(src.coll).aggregate(pipeline).toArray();

    const docs = (agg && agg.items) || [];
    const total = (agg && agg.count && agg.count[0] && agg.count[0].total) || 0;

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
      hideZero,
      facetSourceStyle: src.style,
      facetSourceColl: src.coll,
    });
  } catch (e) {
    console.error("[FACET] error:", e);
    next(e);
  }
});

module.exports = router;
