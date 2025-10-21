// router/jobSeeker.js  (FULL DROP-IN, with payment gating)
"use strict";

const express = require("express");
const router = express.Router();
const methodOverride = require("method-override");
const mongoose = require("mongoose");

const JobSeeker = require("../model/jobSeeker");
const validateObjectId = require("../middleware/validateObjectId");

// ✅ 로그인/결제 가드 추가
const { requireLogin } = require("../middleware/auth"); // 이미 프로젝트에 있는 로그인 미들웨어
const { requireActiveResumeAccess } = require("../middleware/access"); // 새로 추가한 결제/만기 가드

router.use(methodOverride("_method"));
router.param("id", validateObjectId("id"));

/* -------------------- Presets (뷰에 주입) -------------------- */
const defaultNationalities = [
  "Korean",
  "Japanese",
  "Chinese",
  "Malaysian",
  "Thai",
  "American",
  "British",
];
const defaultPrefWorkLocs = [
  "Korea",
  "Japan",
  "China",
  "Malaysia",
  "Thailand",
  "Remote",
];
const defaultMajors = [
  "English",
  "ESL",
  "Education",
  "Art",
  "Biology",
  "Social Studies",
  "Spanish",
];
const defaultLanguages = [
  "English",
  "Korean",
  "Japanese",
  "Chinese",
  "Spanish",
  "French",
  "German",
];

/* -------------------- Helpers -------------------- */
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 문자열/배열/콤마 CSV 모두 → 배열<string>
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

// body → 표준 페이로드 정규화
function normalizePayload(body) {
  const title =
    body["rdfs:label"]?.["@value"] ?? body._label ?? body.title ?? "";

  const description =
    body["http://purl.org/dc/elements/1.1/description"]?.["@value"] ??
    body._description ??
    body.description ??
    "";

  const nationality =
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
    body["schema:knowsLanguage"]?.["@value"] ??
      body.languageSpoken ??
      body.languages ??
      ""
  );

  return {
    fullName: body.fullName ?? body.name ?? "",
    email: body.email ?? "",
    title,
    description,
    nationality,
    preferredWorkLocation,
    major,
    languageSpoken, // 스키마가 String이면 아래에서 join 처리
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
  const db = mongoose.connection.db;
  const doc = {
    _id: js._id,
    "@id": js["@id"] || `jobseeker:${js._id}`,
    _class: "Job_Seekers",
    _label: js._label || js.title || js.name || js.fullName || js.email || "",
    _description: js._description || js.description || js.summary || "",
    // 패싯 3종 (여러 키 변형 흡수)
    Nationality: js.Nationality ?? js.nationality ?? "",
    Preferred_Work_Location:
      js.Preferred_Work_Location ??
      js.preferredWorkLocation ??
      js.preferred_work_location ??
      "",
    Major: js.Major ?? js.major ?? "",
    datePosted: js.datePosted || js.dateAvailable || js.createdAt || new Date(),
    updatedAt: new Date(),
  };
  await db
    .collection("Job_Seekers_RDF")
    .updateOne({ _id: js._id }, { $set: doc }, { upsert: true });
}

/* -------------------- NEW (결제 가드 적용) -------------------- */
// 미결제/만기 사용자는 결제 페이지로 리다이렉트
router.get(
  "/job-seekers/new",
  requireLogin,
  requireActiveResumeAccess,
  (req, res) => {
    res.render("jobSeeker/new", {
      nationalities: defaultNationalities,
      preferredWorkLocations: defaultPrefWorkLocs,
      majors: defaultMajors,
      languages: defaultLanguages,
      values: {},
      errors: {},
    });
  }
);

/* -------------------- CREATE (결제 가드 적용) -------------------- */
router.post(
  "/job-seekers",
  requireLogin,
  requireActiveResumeAccess,
  async (req, res) => {
    try {
      console.log("JobSeeker CREATE body:", req.body);
      const payload = normalizePayload(req.body);
      const errors = validatePayload(payload);
      if (Object.keys(errors).length) {
        return res.status(422).render("jobSeeker/new", {
          nationalities: defaultNationalities,
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
  }
);

/* -------------------- EDIT -------------------- */
router.get("/job-seekers/:id/edit", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const jobSeeker = await JobSeeker.findById(id);
    if (!jobSeeker) return res.status(404).send("Not found");

    // Check if user is owner or admin
    const currentUser = req.user;
    const isAdmin = req.session?.isAdmin || req.user?.isAdmin || false;
    const isOwner = currentUser && jobSeeker.email && currentUser.email === jobSeeker.email;
    
    if (!isAdmin && !isOwner) {
      req.flash?.('error', 'You do not have permission to edit this job seeker profile');
      return res.redirect(`/rdf-resource/Job_Seekers/${id}`);
    }

    res.render("jobSeeker/edit", {
      jobSeeker,
      nationalities: defaultNationalities,
      preferredWorkLocations: defaultPrefWorkLocs,
      majors: defaultMajors,
      languages: defaultLanguages,
      errors: {},
    });
  } catch (err) {
    console.error("[JobSeeker EDIT] error:", err);
    return res
      .status(500)
      .render("error", { message: "Failed to open job seeker", error: err });
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
      return res.status(422).render("jobSeeker/edit", {
        jobSeeker: jobSeeker
          ? { ...jobSeeker.toObject(), ...payload }
          : payload,
        nationalities: defaultNationalities,
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

    const updated = await JobSeeker.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (updated) await mirrorToRDF_JobSeeker(updated);

    req.flash?.("success", "JobSeeker profile updated.");
    return res.redirect("/facet/Job_Seekers");
  } catch (err) {
    console.error("[JobSeeker UPDATE] error:", err);
    return res
      .status(500)
      .render("error", { message: "Failed to update job seeker", error: err });
  }
});

module.exports = router;
