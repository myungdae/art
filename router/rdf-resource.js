// router/rdf-resource.js
"use strict";

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const dbOf = () => mongoose.connection.db;

/* =============== utils =============== */
const cleanHtml = (html = "") => (html || "").replace(/\u00A0/g, " ").trim();
const toArray = (v) =>
  v == null ? [] : Array.isArray(v) ? v.filter(Boolean) : (v !== "" ? [v] : []);
const safeObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};
const pickFirst = (obj, keys, def = "") => {
  for (const k of keys) if (obj && obj[k]) return obj[k];
  return def;
};
const labelize = (key) =>
  key.replace(/^_+/, "")
     .replace(/([a-z])([A-Z])/g, "$1 $2")
     .replace(/_/g, " ")
     .replace(/\s+/g, " ")
     .trim()
     .replace(/^\w/, (c) => c.toUpperCase());
const fmtValue = (v) => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.join(", ");
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
};

/* =============== merge helpers (빈 값은 덮어쓰지 않기) =============== */
function isNonEmpty(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Date) return true;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}
function mergeNonEmpty(target, source) {
  if (!source) return target;
  for (const [k, v] of Object.entries(source)) {
    if (!isNonEmpty(v)) continue;
    const cur = target[k];
    if (!isNonEmpty(cur)) target[k] = v;
  }
  return target;
}

/* =============== description 후보 추출 (RDF 네임스페이스 포함) =============== */
function extractTexts(v) {
  const out = [];
  const push = (s) => { if (typeof s === "string" && s.trim()) out.push(s.trim()); };
  if (typeof v === "string") { push(v); return out; }
  if (Array.isArray(v)) { v.forEach((x) => out.push(...extractTexts(x))); return out; }
  if (v && typeof v === "object") {
    if (v["@value"]) push(String(v["@value"]));
    const langs = ["ko", "en"];
    for (const lang of langs) if (v[lang]) push(String(v[lang]));
    for (const [k, val] of Object.entries(v)) {
      if (["@value", "@language"].includes(k)) continue;
      if (typeof val === "string") push(val);
      else if (Array.isArray(val) || (val && typeof val === "object")) {
        out.push(...extractTexts(val));
      }
    }
  }
  return out;
}
function pickBestDescription(src = {}) {
  const keys = [
    "_description",
    "jobDescription", "job_description", "jobDesc",
    "description", "desc", "Description",
    "about", "bio", "details", "detail", "content", "body", "text",
    // RDF-style
    "dc:description", "dcterms:description", "dct:description",
    "schema:description", "rdfs:comment"
  ];
  let candidates = [];
  for (const k of keys) if (src[k] != null) candidates.push(...extractTexts(src[k]));
  if (!candidates.length && Array.isArray(src["@graph"])) {
    for (const node of src["@graph"]) {
      for (const k of keys) if (node && node[k] != null) {
        candidates.push(...extractTexts(node[k]));
      }
    }
  }
  if (!candidates.length) return { chosen: "", candidates: [] };
  const isAuto = (s) => /^(\s*(Auto:|Position:))/i.test(s);
  const nonAuto = candidates.filter((s) => s && !isAuto(s));
  const pickLongest = (list) => list.reduce((a, b) => (b.length > a.length ? b : a));
  const chosen = nonAuto.length ? pickLongest(nonAuto) : pickLongest(candidates);
  return { chosen, candidates };
}

/* =============== fetch + merge (RDF > 원본 > resources) =============== */
async function fetchMergedById(db, facetBase, _id) {
  const rdfCol = `${facetBase}_RDF`;
  const [rdf, main, mirror] = await Promise.all([
    db.collection(rdfCol).findOne({ _id }),
    db.collection(facetBase).findOne({ _id }),
    db.collection("resources").findOne({ _id, type: facetBase }),
  ]);
  if (!rdf && !main && !mirror) return null;
  const merged = {};
  mergeNonEmpty(merged, mirror || {});
  mergeNonEmpty(merged, main || {});
  mergeNonEmpty(merged, rdf || {});
  return merged;
}

/* =============== 표준화 VM =============== */
function normalize(doc = {}, facetBase) {
  const title = String(doc._label || pickFirst(doc, ["title", "name"], "")).trim();

  // 후보군은 항상 확보(ReferenceError 방지 & 디버그)
  const { chosen: pickedDesc, candidates: descCandidates } = pickBestDescription(doc);

  // description: 통합 규칙
  const direct =
    (doc && typeof doc.description === "string" && doc.description.trim())
      ? doc.description.trim()
      : "";

  const explicit = cleanHtml(
    doc._description ||
    pickFirst(doc, [
      "desc", "jobDescription", "about", "bio",
      "dc:description", "dcterms:description",
      "schema:description", "rdfs:comment"
    ], "")
  );

  const fromCandidates = cleanHtml(pickedDesc || "");

  const descriptionHtml = cleanHtml(
    direct || explicit || fromCandidates || ""
  );

  const meta = {
    country: doc.country || doc?.location?.country || "",
    studentType: toArray(doc.studentType || doc.student_type),
    teachingArea: toArray(doc.teachingArea || doc.teachingAreas || doc.teaching_area),
    languages: toArray(doc.languages || doc.language),
    companyName: doc.companyName || doc.schoolName || "",
    jobLocation: doc.jobLocation || doc.location || doc.city || "",
    pay: doc.pay || "",
    housing: doc.housing || "",
    email: doc.email || "",
    homepage: doc.homepage || doc.website || "",
    datePosted: doc.datePosted
      ? new Date(doc.datePosted)
      : doc.updatedAt
      ? new Date(doc.updatedAt)
      : doc.createdAt
      ? new Date(doc.createdAt)
      : null,
  };

  const used = new Set([
    "_id","_class","__v","_label","_description",
    "title","name","description","desc","jobDescription","about","bio","details","detail",
    "country","location","studentType","student_type",
    "teachingArea","teachingAreas","teaching_area",
    "languages","language",
    "companyName","schoolName",
    "jobLocation","city",
    "pay","housing","email",
    "homepage","website",
    "datePosted","createdAt","updatedAt","type","status","visible",
    "@graph","dc:description","dcterms:description","dct:description","schema:description","rdfs:comment"
  ]);

  const extras = [];
  for (const [k, v] of Object.entries(doc)) {
    if (used.has(k) || (k && String(k).startsWith("@"))) continue;
    extras.push({ key: k, label: labelize(k), value: fmtValue(v) });
  }

  const semanticChips = [];
  if (meta.country) semanticChips.push({ key: "country", values: [meta.country] });
  if (meta.studentType.length) semanticChips.push({ key: "studentType", values: meta.studentType });
  if (meta.teachingArea.length) semanticChips.push({ key: "teachingArea", values: meta.teachingArea });

  return {
    id: doc._id?.toString?.() || "",
    facetBase,
    title,
    descriptionHtml,
    meta,
    extras,
    raw: doc,
    semanticChips,
    // 템플릿에서 필요 없으면 출력 안 해도 됩니다.
    descDebug: descCandidates,
  };
}

/* =============== Routes =============== */
// Job Vacancies
router.get("/Job_Vacancies/:id", async (req, res, next) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) return res.status(404).send("Invalid id");
    const merged = await fetchMergedById(dbOf(), "Job_Vacancies", _id);
    if (!merged) return res.status(404).send("Not found");
    const vm = normalize(merged, "Job_Vacancies");
    return res.render("rdf-resource/jobVacancyShow", { vm });
  } catch (err) {
    console.error("GET /rdf-resource/Job_Vacancies/:id", err);
    return next(err);
  }
});

// Job Seekers
router.get("/Job_Seekers/:id", async (req, res, next) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) return res.status(404).send("Invalid id");
    const merged = await fetchMergedById(dbOf(), "Job_Seekers", _id);
    if (!merged) return res.status(404).send("Not found");
    const vm = normalize(merged, "Job_Seekers");
    return res.render("rdf-resource/jobSeekerShow", { vm });
  } catch (err) {
    console.error("GET /rdf-resource/Job_Seekers/:id error:", err);
    return next(err);
  }
});

// Online Tutors
router.get("/Online_Tutors/:id", async (req, res, next) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) return res.status(404).send("Invalid id");
    const merged = await fetchMergedById(dbOf(), "Online_Tutors", _id);
    if (!merged) return res.status(404).send("Not found");
    const vm = normalize(merged, "Online_Tutors");
    return res.render("rdf-resource/onlineTutorShow", { vm });
  } catch (err) {
    console.error("GET /rdf-resource/Online_Tutors/:id", err);
    return next(err);
  }
});

/* ---- (옵션) description 후보 직접 확인 디버그 ----
router.get("/_debug/Job_Vacancies/:id/desc", async (req, res) => {
  const _id = safeObjectId(req.params.id);
  if (!_id) return res.status(400).json({ ok:false, error:"bad id" });
  const merged = await fetchMergedById(dbOf(), "Job_Vacancies", _id);
  if (!merged) return res.status(404).json({ ok:false, error:"not found" });
  const { chosen, candidates } = pickBestDescription(merged);
  res.json({ ok:true, chosen, candidates, keys: Object.keys(merged) });
});
*/

module.exports = router;
