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
      { key: "country", aliases: ["Country", "country.name", "country.code"], label: "Country" },
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

/*  집계 결과 + 사전 컬렉션 병합 */
async function buildFacetsWithSeeds(db, klass, groups, aggObj, hideZero) {
  const out = {};
  for (const g of groups) {
    const byName = `by_${g.key}`;
    const live = ((aggObj && aggObj[byName]) || []).filter((x) => x && x._id != null);
    const dictColl = DICT_MAP[klass]?.[g.key];

    const liveMap = new Map(live.map((x) => [String(x._id), x.c]));

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
      } catch {}

      const merged = [];
      if (seeds.length) {
        for (const s of seeds) {
          const key = String(s.name || "");
          const c = liveMap.get(key) ?? 0;
          if (!hideZero || c > 0) merged.push({ _id: key, c });
          liveMap.delete(key);
        }
        for (const [key, c] of liveMap) {
          if (!hideZero || c > 0) merged.push({ _id: key, c });
        }
      } else {
        for (const [key, c] of liveMap) {
          if (!hideZero || c > 0) merged.push({ _id: key, c });
        }
      }

      merged.sort((a, b) => (b.c - a.c) || String(a._id).localeCompare(String(b._id)));
      out[g.key] = merged;
    } else {
      let merged = live.map((x) => ({ _id: String(x._id), c: x.c }));
      if (hideZero) merged = merged.filter((x) => x.c > 0);
      merged.sort((a, b) => (b.c - a.c) || String(a._id).localeCompare(String(b._id)));
      out[g.key] = merged;
    }
  }
  return out;
}

/* -------------------- 데이터 소스 선택 -------------------- */
/**
 * 새 글이 resources에 저장되므로 기본 우선순위를
 *   1) resources (type=klass)
 *   2) direct   (Job_Vacancies 등 원본)
 *   3) RDF      (${klass}_RDF, _class=klass)
 * 로 변경. ?source=resources|direct|rdf 로 강제 선택 지원.
 */
async function pickSource(db, klass, prefer) {
  const directName = klass;
  const rdfName = `${klass}_RDF`;

  const hasOne = async (coll, match) => {
    try {
      const exists = await db.listCollections({ name: coll }).toArray();
      if (!exists.length) return false;
      const one = await db.collection(coll).findOne(match || {}, { projection: { _id: 1 } });
      return !!one;
    } catch {
      return false;
    }
  };

  // 강제 선택
  if (prefer === "resources" && (await hasOne("resources", { type: klass }))) {
    return { coll: "resources", style: "resources", baseMatch: { type: klass }, reason: "forced" };
  }
  if (prefer === "direct" && (await hasOne(directName))) {
    return { coll: directName, style: "direct", baseMatch: {}, reason: "forced" };
  }
  if (prefer === "rdf" && (await hasOne(rdfName, { _class: klass }))) {
    return { coll: rdfName, style: "rdf", baseMatch: { _class: klass }, reason: "forced" };
  }

  // 자동 선택: resources → direct → rdf
  if (await hasOne("resources", { type: klass })) {
    return { coll: "resources", style: "resources", baseMatch: { type: klass }, reason: "auto" };
  }
  if (await hasOne(directName)) {
    return { coll: directName, style: "direct", baseMatch: {}, reason: "auto" };
  }
  if (await hasOne(rdfName, { _class: klass })) {
    return { coll: rdfName, style: "rdf", baseMatch: { _class: klass }, reason: "auto" };
  }

  // fallback
  return { coll: rdfName, style: "rdf", baseMatch: { _class: klass }, reason: "fallback" };
}

/* -------------------- country 정규화 스테이지 -------------------- */
// 1) country / Country -> countryStr
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

// 2) countryStr -> countryCanon
const addCountryCanonStage = {
  $addFields: {
    countryCanon: {
      $let: {
        vars: {
          s0: { $trim: { input: { $ifNull: ["$countryStr", ""] } } },
        },
        in: {
          $let: {
            vars: {
              s1: {
                $cond: [
                  { $regexMatch: { input: "$$s0", regex: /^\s*\{.*\}\s*$/ } },
                  {
                    $let: {
                      vars: {
                        code: { $regexFind: { input: "$$s0", regex: /"code"\s*:\s*"([^"]+)"/i } },
                        name: { $regexFind: { input: "$$s0", regex: /"name"\s*:\s*"([^"]+)"/i } },
                      },
                      in: {
                        $cond: [
                          { $ne: ["$$code", null] },
                          { $arrayElemAt: ["$$code.captures", 0] },
                          {
                            $cond: [
                              { $ne: ["$$name", null] },
                              { $arrayElemAt: ["$$name.captures", 0] },
                              "",
                            ],
                          },
                        ],
                      },
                    },
                  },
                  "$$s0",
                ],
              },
            },
            in: {
              $let: {
                vars: { up: { $toUpper: "$$s1" } },
                in: {
                  $switch: {
                    branches: [
                      { case: { $in: ["$$up", ["KOREA", "KOREA (SOUTH)", "REPUBLIC OF KOREA", "KOREA, REPUBLIC OF (SOUTH KOREA)", "KR"]] }, then: "Korea" },
                      { case: { $in: ["$$up", ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA", "U.S.", "U. S."]] }, then: "US" },
                      { case: { $in: ["$$up", ["UNITED KINGDOM", "UK", "GB"]] }, then: "United Kingdom" },
                      { case: { $in: ["$$up", ["AUSTRALIA", "AU"]] }, then: "Australia" },
                      { case: { $in: ["$$up", ["CANADA", "CA"]] }, then: "Canada" },
                      { case: { $in: ["$$up", ["JAPAN", "JP"]] }, then: "Japan" },
                      { case: { $in: ["$$up", ["CHINA", "CN"]] }, then: "China" },
                      { case: { $in: ["$$up", ["TAIWAN", "TW"]] }, then: "Taiwan" },
                      { case: { $in: ["$$up", ["HONG KONG", "HK"]] }, then: "Hong Kong" },
                      { case: { $in: ["$$up", ["VIETNAM", "VN"]] }, then: "Vietnam" },
                    ],
                    default: "$$s1",
                  },
                },
              },
            },
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

    // 소스 선택 (쿼리로 강제 가능)
    const prefer = (req.query.source || req.query.src || "").toLowerCase();
    const src = await pickSource(db, klass, prefer);
    res.set("X-Facet-Source", `${src.style}:${src.coll}`);
    if (prefer) res.set("X-Facet-Source-Forced", prefer);

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

    if (src.style === "direct" && klass === "Job_Vacancies") {
      preMatch.visible = { $ne: false };
      preMatch.status = { $ne: "deleted" };
    }

    if (qText) {
      const rx = new RegExp(sanitizeRegex(qText), "i");
      const fields = spec.searchFields || ["_label", "title", "_description"];
      preMatch.$or = fields.map((f) => ({ [f]: rx }));
    }

    // country는 countryCanon으로만 필터 (preMatch에는 넣지 않음)
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
    const postCountryMatchStages =
      selected.country && selected.country.length
        ? [{ $match: { countryCanon: { $in: selected.country } } }]
        : [];

    const commonInnerStages = [addCountryStrStage, addCountryCanonStage, ...postCountryMatchStages];

    const itemProject = {
      _id: 1,
      "@id": 1,
      displayLabel: coalesce("$_label", "$title", "$name", "$jobTitle", "$email", "Untitled"),
      displayDescription: coalesce("$_description", "$description"),
      _label: 1,
      title: 1,
      _description: 1,
      description: 1,
      country: "$countryCanon",
      studentType: 1,
      teachingArea: 1,
      date: 1,
      datePosted: 1,
      updatedAt: 1,
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

    for (const g of spec.groups) {
      const name = `by_${g.key}`;
      const allKeys = [g.key, ...(g.aliases || [])];
      const arr = [...commonInnerStages];

      if (g.key === "country") {
        arr.push({ $match: { countryCanon: { $ne: null, $ne: "" } } });
        arr.push({ $group: { _id: "$countryCanon", c: { $sum: 1 } } });
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

      arr.push({ $sort: { c: -1, _id: 1 } });
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
