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
    // Job Seekers specific fields
    nationality: doc.nationality || doc.Nationality || "",
    preferredWorkLocation: doc.preferredWorkLocation || doc.Preferred_Work_Location || "",
    major: doc.major || doc.Major || "",
    languageSpoken: doc.languageSpoken || "",
    dateAvailable: doc.dateAvailable ? new Date(doc.dateAvailable) : null,
    // Online Tutors specific fields
    Tutoring_Experience: doc.Tutoring_Experience || doc.tutoringExperience || "",
    Gender: doc.Gender || doc.gender || "",
    Expertise: doc.Expertise || doc.expertise || "",
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
    // Job Seekers fields
    "nationality",
    "Nationality",
    "preferredWorkLocation",
    "Preferred_Work_Location",
    "major",
    "Major",
    "languageSpoken",
    "dateAvailable",
    // Online Tutors fields
    "Tutoring_Experience",
    "tutoringExperience",
    "Gender",
    "gender",
    "Expertise",
    "expertise",
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

/* ─────────────────────────────────────────────────────────
   ART+ 컬렉션 공통 헬퍼
   ───────────────────────────────────────────────────────── */
function getDb() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return Promise.resolve(mongoose.connection.db);
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("MongoDB 연결 대기 초과")), 10000);
    mongoose.connection.once("connected", () => { clearTimeout(t); resolve(mongoose.connection.db); });
    mongoose.connection.once("error",     (e) => { clearTimeout(t); reject(e); });
  });
}

const ART_COLL_MAP = {
  Artworks:    { coll: "Artworks_RDF",    icon: "🖼️", label: "작품",   facetBase: "Artworks" },
  Artists:     { coll: "Artists_RDF",     icon: "👤", label: "작가",   facetBase: "Artists" },
  Galleries:   { coll: "Galleries_RDF",   icon: "🏛️", label: "갤러리", facetBase: "Galleries" },
  Exhibitions: { coll: "Exhibitions_RDF", icon: "🎭", label: "전시",   facetBase: "Exhibitions" },
  Auctions:    { coll: "Auctions_RDF",    icon: "🔨", label: "경매",   facetBase: "Auctions" },
};

// GET /rdf-resource/:artKlass/:id  — Artworks / Artists / Galleries / Exhibitions / Auctions
router.get("/:artKlass/:id", async (req, res, next) => {
  const meta = ART_COLL_MAP[req.params.artKlass];
  if (!meta) return next(); // 알 수 없는 클래스 → 다음 핸들러

  try {
    const _id = safeObjectId(req.params.id);
    if (!_id) return res.status(404).render("error", { message: "잘못된 ID", error: {} });

    const db  = await getDb();
    const doc = await db.collection(meta.coll).findOne({ _id });
    if (!doc) return res.status(404).render("error", { message: "문서를 찾을 수 없습니다.", error: {} });

    // title 후보
    const title = (
      doc._label || doc.title || doc.artworkTitle ||
      doc.artistName || doc.name || "(제목 없음)"
    ).toString().trim();

    // description
    const descriptionHtml = cleanHtml(doc._description || doc.description || "");

    // 나머지 extras (meta에 없는 필드 자동 표시)
    const SKIP = new Set(["_id","__v","_class","_label","_description","createdAt","updatedAt",
      "title","artworkTitle","artistName","name","description",
      "genre","style","medium","material","theme","movement",
      "country","creationYear","imageUrl","priceValue","priceDate"]);
    const extras = [];
    for (const [k, v] of Object.entries(doc)) {
      if (SKIP.has(k) || k.startsWith("@")) continue;
      const fv = fmtValue(v);
      if (fv) extras.push({ key: k, label: labelize(k), value: fv });
    }

    // Artists일 때: 해당 작가의 작품 갤러리 추가 쿼리
    let artistWorks = [];
    if (req.params.artKlass === "Artists") {
      const artistName = doc.artistName || doc.name || doc._label || "";
      if (artistName) {
        artistWorks = await db.collection("Artworks_RDF")
          .find(
            { artistName: { $regex: new RegExp("^" + artistName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } },
            { projection: { _id: 1, _label: 1, title: 1, artworkTitle: 1, imageUrl: 1, genre: 1, style: 1, medium: 1, creationYear: 1 } }
          )
          .sort({ creationYear: 1, updatedAt: -1 })
          .limit(40)
          .toArray();
      }
    }

    // 설명이 없을 때 메타 정보 기반 mock 설명 생성
    let finalDescriptionHtml = descriptionHtml;
    if (!finalDescriptionHtml) {
      const parts = [];
      const artistName = doc.artistName || doc.name || "";
      const year       = doc.creationYear || "";
      const genre      = doc.genre || "";
      const style      = doc.style || "";
      const medium     = doc.medium || "";
      const material   = doc.material ? (Array.isArray(doc.material) ? doc.material.join(", ") : doc.material) : "";
      const country    = doc.country || "";
      const klass      = meta.label;

      if (klass === "작품") {
        if (artistName) parts.push(`${artistName} 작가의 작품입니다.`);
        if (year)       parts.push(`${year}년에 제작되었으며,`);
        if (genre)      parts.push(`${genre} 장르에 속합니다.`);
        if (style)      parts.push(`${style} 양식으로 표현된 이 작품은`);
        if (medium)     parts.push(`${medium}을(를) 매체로 사용하였고,`);
        if (material)   parts.push(`재료로는 ${material}을(를) 활용하였습니다.`);
        if (country)    parts.push(`제작 국가는 ${country}입니다.`);
        parts.push("작가의 독창적인 시각과 조형 언어가 담긴 작품으로, 당대의 사회·문화적 맥락을 반영하며 깊은 울림을 전합니다.");
      } else if (klass === "작가") {
        if (artistName || title) parts.push(`${artistName || title}은(는)`);
        if (country)   parts.push(`${country} 출신의 작가로,`);
        parts.push("독자적인 예술 세계를 구축한 작가입니다. 작품 활동을 통해 다양한 시각적 언어를 탐구하며, 국내외 전시에서 활발히 활동하고 있습니다.");
      } else if (klass === "갤러리") {
        if (country)   parts.push(`${country}에 위치한`);
        parts.push(`${title}은(는) 다양한 장르의 예술 작품을 소개하는 공간입니다. 신진 및 중견 작가들의 전시를 기획하며, 예술과 대중의 접점을 넓혀가고 있습니다.`);
      } else if (klass === "전시") {
        parts.push(`${title} 전시는 다채로운 작품들을 한자리에서 선보이는 기획전입니다. 참여 작가들의 역량과 주제 의식이 돋보이는 전시로, 관람객에게 풍부한 예술적 경험을 제공합니다.`);
      } else if (klass === "경매") {
        parts.push(`${title}은(는) 엄선된 작품들이 출품되는 경매입니다. 미술 시장의 흐름을 반영한 작품들이 소개되며, 컬렉터와 애호가 모두에게 주목받는 행사입니다.`);
      } else {
        parts.push("상세 설명이 준비 중입니다. 작품 및 작가에 대한 정보는 곧 업데이트될 예정입니다.");
      }

      finalDescriptionHtml = parts.join(" ");
    }

    const vm = {
      id:              doc._id.toString(),
      facetBase:       meta.facetBase,
      klassLabel:      meta.label,
      klassIcon:       meta.icon,
      title,
      descriptionHtml: finalDescriptionHtml,
      extras,
      raw:             doc,
      artistWorks,
    };

    return res.render("rdf-resource/artShow", { vm });
  } catch (err) {
    console.error(`[rdf-resource/${req.params.artKlass}]`, err.message);
    return next(err);
  }
});

module.exports = router;
