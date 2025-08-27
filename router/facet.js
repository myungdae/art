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

/* -------------------- facet 엔드포인트 -------------------- */
router.get("/:klass", async (req, res, next) => {
  try {
    const klass = req.params.klass; // ex) "Online_Tutors"
    const spec = FACET_MAP[klass] || FACET_MAP.Job_Vacancies;
    const coll = spec.coll ? spec.coll(klass) : `${klass}_RDF`;
    console.log(`[FACET] klass=${klass}, coll=${coll}`);

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
    const facetStages = {
      items: [
        // 최신 우선 정렬(여분 필드 보정)
        {
          $addFields: {
            _s_date: { $ifNull: ["$datePosted", "$updatedAt"] },
          },
        },
        { $sort: { _s_date: -1, _id: -1 } },
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
