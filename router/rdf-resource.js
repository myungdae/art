"use strict";

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { requireLogin } = require("../middleware/auth");

/* ---------- helpers ---------- */

function cleanHtml(html = "") {
  return (html || "").replace(/\u00A0/g, " ").trim();
}
function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}
function safeObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}
async function findOneById(db, preferred, fallback, _id) {
  let doc = await db.collection(preferred).findOne({ _id });
  if (!doc && fallback) {
    doc = await db.collection(fallback).findOne({ _id });
  }
  return doc;
}
function pickFirst(obj, keys, def = "") {
  for (const k of keys) if (obj[k]) return obj[k];
  return def;
}
function labelize(key) {
  return key
    .replace(/^_+/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
function fmtValue(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.join(", ");
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * 공통 VM 빌더
 * - facetBase: 'Job_Vacancies' | 'Job_Seekers' | 'Online_Tutors'
 * - 제목/본문 라벨은 항상 Title / Description 으로 통일
 * - meta: 표준 필드
 * - extras: meta/제목/본문에 쓰이지 않은 나머지 원시 키 자동 표기
 */
function buildVM(doc, facetBase, titleKeys = [], descKeys = []) {
  const used = new Set(["_id", "_class", "createdAt", "updatedAt", "__v"]);

  const title = (doc._label || pickFirst(doc, titleKeys, "") || "")
    .toString()
    .trim();
  if (doc._label) used.add("_label");
  for (const k of titleKeys) used.add(k);

  const descriptionHtml = cleanHtml(
    doc._description || pickFirst(doc, descKeys, "")
  );
  if (doc._description) used.add("_description");
  for (const k of descKeys) used.add(k);

  // meta (표준화)
  const meta = {
    country: doc.country || "",
    studentType: doc.studentType || "",
    teachingAreas: toArray(doc.teachingArea),
    languages: toArray(doc.languages || doc.language),
    companyName: doc.companyName || doc.schoolName || "",
    jobLocation: doc.jobLocation || doc.location || doc.city || "",
    pay: doc.pay || "",
    housing: doc.housing || "",
    cellphoneNumber: doc.cellphoneNumber || doc.cellphone || "",
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

  // 사용된 키 마킹
  [
    "country",
    "studentType",
    "teachingArea",
    "languages",
    "language",
    "companyName",
    "schoolName",
    "jobLocation",
    "location",
    "city",
    "pay",
    "housing",
    "cellphoneNumber",
    "cellphone",
    "email",
    "homepage",
    "website",
    "datePosted",
  ].forEach((k) => used.add(k));

  // Additional Details: 아직 사용 안 된 원시 키들을 자동 렌더
  const extras = [];
  for (const [k, v] of Object.entries(doc)) {
    if (used.has(k)) continue;
    if (k.startsWith("@")) continue; // RDF 메타
    if (k === "_id" || k === "__v") continue;
    extras.push({ key: k, label: labelize(k), value: fmtValue(v) });
  }

  return {
    id: doc._id.toString(),
    facetBase,
    title,
    descriptionHtml,
    meta,
    extras,
    raw: doc,
  };
}

/* ---------- Routes ---------- */

// Job Vacancies
router.get("/Job_Vacancies/:id", async (req, res, next) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) return res.status(404).send("Invalid id");

    const db = mongoose.connection.db;
    const doc = await findOneById(
      db,
      "Job_Vacancies_RDF",
      "Job_Vacancies",
      _id
    );
    if (!doc) return res.status(404).send("Not found");

    const vm = buildVM(doc, "Job_Vacancies", ["title"], ["description"]);

    const chipKeys = ["country", "studentType", "teachingArea"];
    vm.semanticChips = chipKeys
      .filter((k) => doc[k] != null && doc[k] !== "")
      .map((k) => ({
        key: k,
        label: k.replace(/_/g, " "),
        values: Array.isArray(doc[k]) ? doc[k] : [doc[k]],
      }));

    // Check if current user can edit (owner or admin)
    // Get user from session (manually check since this route doesn't require login)
    const currentUser = req.session?.user ? {
      ...req.session.user,
      _id: req.session.user._id ? new mongoose.Types.ObjectId(req.session.user._id) : undefined,
      email: req.session.user.email,
      role: req.session.user.role
    } : null;
    const isAdmin = req.session?.isAdmin || req.user?.isAdmin || false;
    // Job Vacancy can only be edited by Employer with matching email
    const isOwner = currentUser && 
                    doc.email && 
                    currentUser.email === doc.email &&
                    currentUser.role === 'Employer';
    vm.canEdit = isAdmin || isOwner;
    
    // Debug logging - always log for this specific job
    if (String(doc._id) === '68f7d2c40de4207945a7130d') {
      console.log('🔍 [Job Vacancy 68f7d2c40de4207945a7130d] Edit check:', {
        docEmail: doc.email,
        currentUser: currentUser ? {
          email: currentUser.email,
          role: currentUser.role,
          _id: currentUser._id
        } : null,
        isAdmin,
        isOwner,
        emailMatch: currentUser?.email === doc.email,
        roleMatch: currentUser?.role === 'Employer',
        canEdit: vm.canEdit,
        session: {
          isAdmin: req.session?.isAdmin,
          userRole: req.session?.user?.role,
          userEmail: req.session?.user?.email
        }
      });
    }

    return res.render("rdf-resource/jobVacancyShow", { vm });
  } catch (err) {
    console.error("GET /rdf-resource/Job_Vacancies/:id", err);
    return next(err);
  }
});

// Job Seekers (커스텀 시맨틱 칩 포함)
router.get("/Job_Seekers/:id", async (req, res, next) => {
  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) return res.status(404).send("Invalid id");

    const db = mongoose.connection.db;
    const doc = await findOneById(db, "Job_Seekers_RDF", "Job_Seekers", _id);
    if (!doc) return res.status(404).send("Not found");

    const vm = buildVM(
      doc,
      "Job_Seekers",
      ["title", "name"],
      ["description", "about", "bio"]
    );

    // 커스텀 시맨틱 -> 칩으로 노출할 키들
    const chipKeys = ["Nationality", "Preferred_Work_Location", "Major"];
    vm.semanticChips = chipKeys
      .filter((k) => doc[k] != null && doc[k] !== "")
      .map((k) => ({
        key: k,
        label: k.replace(/_/g, " "),
        values: Array.isArray(doc[k]) ? doc[k] : [doc[k]],
      }));

    // Check if current user can edit (owner or admin)
    // Get user from session (manually check since this route doesn't require login)
    const currentUser = req.session?.user ? {
      ...req.session.user,
      _id: req.session.user._id ? new mongoose.Types.ObjectId(req.session.user._id) : undefined,
      email: req.session.user.email,
      role: req.session.user.role
    } : null;
    const isAdmin = req.session?.isAdmin || false;
    // Job Seeker can only be edited by Job_Seeker with matching email
    const isOwner = currentUser && 
                    doc.email && 
                    currentUser.email === doc.email &&
                    currentUser.role === 'Job_Seeker';
    vm.canEdit = isAdmin || isOwner;
    
    // Debug logging
    if (currentUser && !vm.canEdit) {
      console.log('🔍 [Job Seeker] Edit check failed:', {
        docId: doc._id,
        docEmail: doc.email,
        currentUserEmail: currentUser.email,
        currentUserRole: currentUser.role,
        isAdmin,
        isOwner,
        emailMatch: currentUser.email === doc.email,
        roleMatch: currentUser.role === 'Job_Seeker'
      });
    }

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

    const db = mongoose.connection.db;
    const doc = await findOneById(
      db,
      "Online_Tutors_RDF",
      "Online_Tutors",
      _id
    );
    if (!doc) return res.status(404).send("Not found");

    const vm = buildVM(
      doc,
      "Online_Tutors",
      ["title", "name"],
      ["description", "about", "bio"]
    );

    const chipKeys = ["Expertise", "Gender", "Tutoring_Experience"];
    vm.semanticChips = chipKeys
      .filter((k) => doc[k] != null && doc[k] !== "")
      .map((k) => ({
        key: k,
        label: k.replace(/_/g, " "),
        values: Array.isArray(doc[k]) ? doc[k] : [doc[k]],
      }));
    
    // Check if current user can edit (owner or admin)
    // Get user from session (manually check since this route doesn't require login)
    const currentUser = req.session?.user ? {
      ...req.session.user,
      _id: req.session.user._id ? new mongoose.Types.ObjectId(req.session.user._id) : undefined,
      email: req.session.user.email,
      role: req.session.user.role
    } : null;
    const isAdmin = req.session?.isAdmin || false;
    // Online Tutor can only be edited by Online_Tutor with matching email
    const isOwner = currentUser && 
                    doc.email && 
                    currentUser.email === doc.email &&
                    currentUser.role === 'Online_Tutor';
    vm.canEdit = isAdmin || isOwner;
    
    // Debug logging
    if (currentUser && !vm.canEdit) {
      console.log('🔍 [Online Tutor] Edit check failed:', {
        docId: doc._id,
        docEmail: doc.email,
        currentUserEmail: currentUser.email,
        currentUserRole: currentUser.role,
        isAdmin,
        isOwner,
        emailMatch: currentUser.email === doc.email,
        roleMatch: currentUser.role === 'Online_Tutor'
      });
    }
    
    return res.render("rdf-resource/onlineTutorShow", { vm });
  } catch (err) {
    console.error("GET /rdf-resource/Online_Tutors/:id", err);
    return next(err);
  }
});

module.exports = router;
