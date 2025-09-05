// router/jobSeeker.js  (DROP-IN: DB-backed nationalities + normalization + upsert)
"use strict";

const express = require("express");
const router = express.Router();
const methodOverride = require("method-override");
const mongoose = require("mongoose");

const JobSeeker = require("../model/jobSeeker");
const validateObjectId = require("../middleware/validateObjectId");

// ✅ 로그인/결제 가드
const { requireLogin } = require("../middleware/auth");
const { requireActiveResumeAccess } = require("../middleware/access");

router.use(methodOverride("_method"));
router.param("id", validateObjectId("id"));

/* -------------------- Presets (fallback only) -------------------- */
// DB에 아무것도 없을 때 대비한 최소 fallback
const fallbackNationalities = ["Korean", "American", "British", "Japanese", "Chinese"];

// 다른 프리셋(기존 유지)
const defaultPrefWorkLocs = ["Korea", "Japan", "China", "Malaysia", "Thailand", "Remote"];
const defaultMajors = ["English", "ESL", "Education", "Art", "Biology", "Social Studies", "Spanish"];
const defaultLanguages = ["English", "Korean", "Japanese", "Chinese", "Spanish", "French", "German"];

/* -------------------- Helpers -------------------- */
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toStringArray(v) {
  if (Array.isArray(v)) {
    return v
      .flatMap((x) => String(x).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── nationality 정규화
function normalizeNationality(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

// ── DB 핸들
function getDb() {
  // mongoose 초기화가 app.js에서 connect()로 이뤄지므로 연결 존재
  return mongoose.connection.db;
}

// ── DB에서 nationalities 읽기 (정렬된 배열)
async function fetchNationalities() {
  const db = getDb();
  const list = await db
    .collection("nationalities")
    .find({})
    .sort({ name: 1 })
    .project({ _id: 0, name: 1 })
    .toArray();
  const names = list.map((x) => x.name);
  return names.length ? names : fallbackNationalities;
}

// ── nationalities 컬렉션 upsert (없으면 추가)
async function upsertNationality(name) {
  const nat = normalizeNationality(name);
  if (!nat) return;
  const db = getDb();
  await db.collection("nationalities").updateOne(
    { name_norm: nat.toLowerCase() },
    { $setOnInsert: { name: nat, name_norm: nat.toLowerCase() } },
    { upsert: true }
  );
}

// body → 표준 페이로드 정규화
function normalizePayload(body) {
  const title = body["rdfs:label"]?.["@value"] ?? body._label ?? body.title ?? "";
  const description =
    body["http://purl.org/dc/elements/1.1/description"]?.["@value"] ??
    body._description ??
    body.description ??
    "";

  const nationalityRaw =
    body["http://schema.org/nationality"]?.["@value"] ??
    body["schema:nationality"]?.["@value"] ??
    body["esl:Nationality"]?.["@value"] ??
    body.Nationality ??
    body.nationality ??
    "";

  const preferredWorkLocation =
    body["esl:preferredWorkLocation"]?.["@value"] ??
    body["esl:Preferred_Work_Location"]?.["@value"] ??
    body.Preferred_Work_Location ??
    body.preferred_work_location ??
    body.preferredWorkLocation ??
    "";

  const major =
    body["esl:major"]?.["@value"] ??
    body["esl:Major"]?.["@value"] ??
    body.Major ??
    body.major ??
    "";

  const languageSpoken = toStringArray(
    body["schema:knowsLanguage"]?.["@value"] ?? body.languageSpoken ?? body.languages ?? ""
  );

  // 저장용: 공란이면 null, 값이 있으면 정규화
  const nationality = normalizeNationality(nationalityRaw);

  return {
    fullName: body.fullName ?? body.name ?? "",
    email: body.email ?? "",
    title,
    description,
    nationality, // null 또는 정규화된 값
    preferredWorkLocation,
    major,
    languageSpoken,
    dateAvailable: parseDate(body.dateAvailable),
  };
}

function validatePayload(p) {
  const errors = {};
  if (!p.email) errors.email = "Email is required.";
  return errors;
}

/* ------------ RDF 미러 (Job_Seekers_RDF) ------------ */
async function mirrorToRDF_JobSeeker(js) {
  const db = getDb();
  const doc = {
    _id: js._id,
    "@id": js["@id"] || `jobseeker:${js._id}`,
    _class: "Job_Seekers",
    _label: js._label || js.title || js.name || js.fullName || js.email || "",
    _description: js._description || js.description || js.summary || "",
    Nationality: js.Nationality ?? js.nationality ?? "",
    Preferred_Work_Location:
      js.Preferred_Work_Location ?? js.preferredWorkLocation ?? js.preferred_work_location ?? "",
    Major: js.Major ?? js.major ?? "",
    datePosted: js.datePosted || js.dateAvailable || js.createdAt || new Date(),
    updatedAt: new Date(),
  };
  await db.collection("Job_Seekers_RDF").updateOne({ _id: js._id }, { $set: doc }, { upsert: true });
}

/* -------------------- NEW (결제 가드 적용) -------------------- */
router.get("/job-seekers/new", requireLogin, requireActiveResumeAccess, async (req, res, next) => {
  try {
    const nationalities = await fetchNationalities();
    res.render("jobSeeker/new", {
      nationalities, // ✅ DB에서 로드
      preferredWorkLocations: defaultPrefWorkLocs,
      majors: defaultMajors,
      languages: defaultLanguages,
      values: { nationality: "Korean" }, // ✅ UI 기본값
      errors: {},
    });
  } catch (e) {
    next(e);
  }
});

/* -------------------- CREATE (결제 가드 적용) -------------------- */
router.post("/job-seekers", requireLogin, requireActiveResumeAccess, async (req, res) => {
  try {
    console.log("JobSeeker CREATE body:", req.body);
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      const nationalities = await fetchNationalities();
      return res.status(422).render("jobSeeker/new", {
        nationalities,
        preferredWorkLocations: defaultPrefWorkLocs,
        majors: defaultMajors,
        languages: defaultLanguages,
        values: req.body,
        errors,
      });
    }

    // 스키마가 String이면 CSV로 저장
    if (JobSeeker.schema.path("languageSpoken")?.instance === "String") {
      payload.languageSpoken = Array.isArray(payload.languageSpoken)
        ? payload.languageSpoken.join(", ")
        : String(payload.languageSpoken || "");
    }

    // 신규 값이면 마스터 upsert (빈값/null은 패스)
    if (payload.nationality) {
      await upsertNationality(payload.nationality);
    }

    // (선택) 소유자 연결
    if (req.user?._id) {
      payload.userId = req.user._id;
    }
    console.log("[JobSeeker CREATE] payload:", payload);

    const doc = new JobSeeker(payload);
    await doc.save();
    await mirrorToRDF_JobSeeker(doc);

    req.flash?.("success", "JobSeeker profile created.");
    return res.redirect("/facet/Job_Seekers");
  } catch (err) {
    console.error("[JobSeeker CREATE] error:", err);
    return res.status(500).render("error", {
      message: "Failed to create job seeker",
      error: err,
    });
  }
});

/* -------------------- EDIT -------------------- */
router.get("/job-seekers/:id/edit", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const jobSeeker = await JobSeeker.findById(id);
    if (!jobSeeker) return res.status(404).send("Not found");

    const nationalities = await fetchNationalities();

    res.render("jobSeeker/edit", {
      jobSeeker,
      nationalities, // ✅ DB에서 로드
      preferredWorkLocations: defaultPrefWorkLocs,
      majors: defaultMajors,
      languages: defaultLanguages,
      errors: {},
    });
  } catch (err) {
    console.error("[JobSeeker EDIT] error:", err);
    return res.status(500).render("error", { message: "Failed to open job seeker", error: err });
  }
});

/* -------------------- UPDATE -------------------- */
router.put("/job-seekers/:id", requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    const payload = normalizePayload(req.body);
    const errors = validatePayload(payload);
    if (Object.keys(errors).length) {
      const jobSeeker = await JobSeeker.findById(id);
      const nationalities = await fetchNationalities();
      return res.status(422).render("jobSeeker/edit", {
        jobSeeker: jobSeeker ? { ...jobSeeker.toObject(), ...payload } : payload,
        nationalities,
        preferredWorkLocations: defaultPrefWorkLocs,
        majors: defaultMajors,
        languages: defaultLanguages,
        errors,
      });
    }

    if (JobSeeker.schema.path("languageSpoken")?.instance === "String") {
      payload.languageSpoken = Array.isArray(payload.languageSpoken)
        ? payload.languageSpoken.join(", ")
        : String(payload.languageSpoken || "");
    }

    // 신규 값이면 마스터 upsert
    if (payload.nationality) {
      await upsertNationality(payload.nationality);
    }

    const updated = await JobSeeker.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (updated) await mirrorToRDF_JobSeeker(updated);

    req.flash?.("success", "JobSeeker profile updated.");
    return res.redirect("/facet/Job_Seekers");
  } catch (err) {
    console.error("[JobSeeker UPDATE] error:", err);
    return res.status(500).render("error", { message: "Failed to update job seeker", error: err });
  }
});

module.exports = router;
