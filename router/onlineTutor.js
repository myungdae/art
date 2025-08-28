"use strict";

const express = require("express");
const router = express.Router();
const methodOverride = require("method-override");
const mongoose = require("mongoose");

const OnlineTutor = require("../model/onlineTutor");
const validateObjectId = require("../middleware/validateObjectId");
const { requireLogin, requireRole } = require("../middleware/auth");
// ✅ 추가: 튜터 가시성 가드
const { requireActiveTutorAccess } = require("../middleware/access");

router.use(methodOverride("_method"));
router.param("id", validateObjectId("id"));

/* -------------------- Presets -------------------- */
const defaultExpertise = [
  "Conversation",
  "Grammar",
  "BusinessEnglish",
  "ExamPrep",
  "TOEFL",
  "IELTS",
  "Kids",
  "Pronunciation",
];
const defaultExperiences = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "5+ years",
  "10+ years",
];
const defaultGenders = ["Male", "Female", "Other", "Prefer not to say"];

/* -------------------- Helpers -------------------- */
const toStringArray = (v) => {
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
};
const mergeExtraCsv = (arr, csv) => {
  const extra = String(csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...(arr || []), ...extra]));
};
// ✅ 첫 번째 “비어있지 않은” 문자열만 채택
const pickFirstNonEmpty = (...vals) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s.length) return s;
  }
  return "";
};

function normalizePayload(body) {
  // ✅ 폼의 title/description을 최우선으로 사용
  const title = pickFirstNonEmpty(
    body.title,
    body._label,
    body["rdfs:label[@value]"]
  );

  const description = pickFirstNonEmpty(
    body.description,
    body._description,
    body["http://purl.org/dc/elements/1.1/description[@value]"]
  );

  // 시맨틱/일반 키 흡수
  let expertise =
    body.Expertise ?? body.expertise ?? body["esl:expertise[@value]"] ?? [];
  // expertise = toStringArray(expertise);
  // expertise = mergeExtraCsv(expertise, body.extraExpertise);

  const tutoringExperience =
    body.Tutoring_Experience ??
    body.tutoringExperience ??
    body["esl:tutoringExperience[@value]"] ??
    "";

  const gender =
    body.Gender ?? body.gender ?? body["schema:gender[@value]"] ?? "";

  const email = String(body.email || "")
    .trim()
    .toLowerCase();

  return {
    title,
    description,
    expertise, // array<string>
    tutoringExperience: String(tutoringExperience || ""),
    gender: String(gender || ""),
    email,
  };
}

function validatePayload(p) {
  const errors = {};
  if (!p.expertise) errors.expertise = "Select at least one expertise.";
  if (!p.tutoringExperience)
    errors.tutoringExperience = "Tutoring experience is required.";
  if (!p.gender) errors.gender = "Gender is required.";
  if (!p.email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    errors.email = "Please enter a valid email.";
  return errors;
}

/* -------------------- RDF Mirror -------------------- */
async function mirrorToRDF(tutorDoc) {
  const db = mongoose.connection.db;

  const doc = {
    _id: tutorDoc._id,
    "@id": tutorDoc["@id"] || `onlinetutor:${tutorDoc._id}`,
    _class: "Online_Tutors",
    _label: tutorDoc._label || tutorDoc.title || "",
    _description: tutorDoc._description || tutorDoc.description || "",
    Expertise: Array.isArray(tutorDoc.expertise)
      ? tutorDoc.expertise
      : tutorDoc.expertise
      ? [tutorDoc.expertise]
      : [],
    Tutoring_Experience: tutorDoc.tutoringExperience || "",
    Gender: tutorDoc.gender || "",
    datePosted: tutorDoc.datePosted || tutorDoc.createdAt || new Date(),
    updatedAt: new Date(),
  };

  await db
    .collection("Online_Tutors_RDF")
    .updateOne({ _id: tutorDoc._id }, { $set: doc }, { upsert: true });

  try {
    await db
      .collection("Online_Tutors")
      .updateOne({ _id: tutorDoc._id }, { $set: doc }, { upsert: true });
  } catch (_) {}
}

/* -------------------- New -------------------- */
// ✅ 가드 추가 + 레거시 경로 겸용
router.get(
  ["/online-tutors/new", "/onlineTutor/new"],
  requireLogin,
  requireRole(["Online_Tutor", "Tutor"]),
  requireActiveTutorAccess, // 🔒 결제/가시성 체크
  async (req, res) => {
    res.render("onlineTutor/new", {
      expertiseList: defaultExpertise,
      expList: defaultExperiences,
      genderList: defaultGenders,
      values: { email: req.user?.email || req.session?.user?.email || "" },
      errors: {},
    });
  }
);

/* -------------------- Create -------------------- */
// ✅ 가드 추가 + 레거시 경로 겸용
router.post(
  ["/online-tutors", "/onlineTutor"],
  requireLogin,
  requireRole(["Online_Tutor", "Tutor"]),
  requireActiveTutorAccess, // 🔒 결제/가시성 체크
  async (req, res) => {
    try {
      const payload = normalizePayload(req.body);
      if (!payload.email && (req.user?.email || req.session?.user?.email)) {
        payload.email = String(
          req.user?.email || req.session.user.email
        ).toLowerCase();
      }

      console.log("payload:", payload);

      const errors = validatePayload(payload);
      console.log("errors:", errors);
      if (Object.keys(errors).length) {
        return res.status(422).render("onlineTutor/new", {
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          values: { ...payload, extraExpertise: req.body.extraExpertise || "" },
          errors,
        });
      }

      // ✅ 폼 값을 최우선으로 반영 (빈 문자열은 무시)
      const title = pickFirstNonEmpty(req.body.title, payload.title);
      const label = pickFirstNonEmpty(req.body._labelOverride, title);
      const _description = pickFirstNonEmpty(
        req.body._descriptionOverride,
        payload.description
      );

      const doc = new OnlineTutor({
        ...payload,
        user: req.session.user._id,
        title,
        label,
        _description,
        datePosted: new Date(),
      });

      await doc.save();
      await mirrorToRDF(doc);

      req.flash?.("success", "Tutor profile created.");
      return res.redirect("/facet/Online_Tutors");
    } catch (err) {
      console.error("Create online tutor error:", err);
      if (err?.name === "ValidationError") {
        const payload = normalizePayload(req.body);
        const valErrs = {};
        for (const k in err.errors)
          valErrs[k] = err.errors[k].message || `Invalid ${k}`;
        return res.status(422).render("onlineTutor/new", {
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          values: { ...payload, extraExpertise: req.body.extraExpertise || "" },
          errors: valErrs,
        });
      }
      console.error("[ONLINE-TUTOR CREATE] error:", err);
      return res.status(500).render("error", {
        message: "Failed to create tutor profile",
        error: err,
      });
    }
  }
);

/* -------------------- Edit -------------------- */
router.get(
  "/online-tutors/:id/edit",
  requireLogin,
  requireRole(["Online_Tutor", "Tutor"]),
  async (req, res) => {
    const { id } = req.params;
    const onlineTutor = await OnlineTutor.findById(id);
    if (!onlineTutor) return res.status(404).send("Not found");

    if (String(onlineTutor.user || "") !== String(req.session.user._id || "")) {
      return res.status(403).send("Forbidden: not owner");
    }

    res.render("onlineTutor/edit", {
      onlineTutor,
      expertiseList: defaultExpertise,
      expList: defaultExperiences,
      genderList: defaultGenders,
      errors: {},
    });
  }
);

/* -------------------- Delete -------------------- */
router.delete(
  "/online-tutors/:id",
  requireLogin,
  requireRole(["Online_Tutor", "Tutor", "Admin"]),
  async (req, res) => {
    const { id } = req.params;
    const doc = await OnlineTutor.findById(id);
    if (!doc) return res.status(404).send("Not found");

    const isOwner =
      String(doc.user || "") === String(req.session.user._id || "");
    const isAdmin = (req.user?.role || "").toLowerCase() === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).send("Forbidden: not owner");

    await OnlineTutor.findByIdAndDelete(id);
    try {
      await mongoose.connection.db
        .collection("Online_Tutors_RDF")
        .deleteOne({ _id: doc._id });
    } catch (_) {}

    return res.redirect("/facet/Online_Tutors");
  }
);

/* -------------------- Update -------------------- */
router.put(
  "/online-tutors/:id",
  requireLogin,
  requireRole(["Online_Tutor", "Tutor"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const payload = normalizePayload(req.body);
      if (!payload.email && (req.user?.email || req.session?.user?.email)) {
        payload.email = String(
          req.user?.email || req.session.user.email
        ).toLowerCase();
      }

      const errors = validatePayload(payload);
      if (Object.keys(errors).length) {
        const onlineTutor = await OnlineTutor.findById(id);
        return res.status(422).render("onlineTutor/edit", {
          onlineTutor: onlineTutor
            ? { ...onlineTutor.toObject(), ...payload }
            : payload,
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          errors,
        });
      }

      // ✅ 폼 값을 최우선으로 반영
      const title = pickFirstNonEmpty(req.body.title, payload.title);
      const _label = pickFirstNonEmpty(req.body._labelOverride, title);
      const _description = pickFirstNonEmpty(
        req.body._descriptionOverride,
        payload.description
      );

      const updated = await OnlineTutor.findByIdAndUpdate(
        id,
        {
          ...payload,
          title,
          _label,
          _description,
          datePosted: new Date(),
        },
        { new: true, runValidators: true }
      );

      if (updated) await mirrorToRDF(updated);

      req.flash?.("success", "Tutor profile updated.");
      return res.redirect("/facet/Online_Tutors");
    } catch (err) {
      if (err?.name === "ValidationError") {
        const payload = normalizePayload(req.body);
        const valErrs = {};
        for (const k in err.errors)
          valErrs[k] = err.errors[k].message || `Invalid ${k}`;
        const onlineTutor = await OnlineTutor.findById(id);
        return res.status(422).render("onlineTutor/edit", {
          onlineTutor: onlineTutor
            ? { ...onlineTutor.toObject(), ...payload }
            : payload,
          expertiseList: defaultExpertise,
          expList: defaultExperiences,
          genderList: defaultGenders,
          errors: valErrs,
        });
      }
      console.error("[ONLINE-TUTOR UPDATE] error:", err);
      return res.status(500).render("error", {
        message: "Failed to update tutor profile",
        error: err,
      });
    }
  }
);

module.exports = router;
