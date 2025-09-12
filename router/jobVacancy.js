// router/jobVacancy.js — Job_Vacancies Create/Update (save to resources)
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const dbOf = () => mongoose.connection.db;

// helpers
const A = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
const S = (s) => (typeof s === "string" ? s.trim() : "");

// 폼에서 올 수 있는 name 변형까지 흡수
function buildPayload(body = {}) {
  return {
    type: "Job_Vacancies",
    title: S(body.title),
    country: S(body.country) || S(body?.location?.country),

    // 본문 통일: description / desc / jobDescription 중 우선값
    description: S(body.description) || S(body.desc) || S(body.jobDescription),

    // 멀티 선택: 배열 보장 (studentType[] / teachingArea[] 지원)
    studentType: A(body.studentType || body["studentType[]"] || body.Student_Type || body["Student_Type[]"]),
    teachingArea: A(body.teachingArea || body["teachingArea[]"] || body.Teaching_Area || body["Teaching_Area[]"]),

    // 기타 메타(있으면 저장)
    languages: A(body.languages || body.language || body["languages[]"] || body["language[]"]),
    companyName: S(body.companyName || body.schoolName),
    jobLocation: S(body.jobLocation || body.location || body.city),
    pay: S(body.pay),
    housing: S(body.housing),
    email: S(body.email),
    homepage: S(body.homepage || body.website),

    status: S(body.status) || "published",
    visible: body.visible !== "false",
    updatedAt: new Date(),
  };
}

router.get("/_debug/ping", (req, res) => res.json({ ok: true, where: "jobVacancy.js" }));

router.post("/_debug/echo", (req, res) => {
  res.json({
    ok: true,
    route: "/_debug/echo",
    body: req.body,
    contentType: req.headers["content-type"]
  });
});

/**
 * CREATE
 * POST /job-vacancies, /job-vacancies/create
 *  - 저장소: resources (type = 'Job_Vacancies')
 *  - 저장 후: /facet/Job_Vacancies 로 리다이렉트
 */
router.post(["/job-vacancies", "/job-vacancies/create"], async (req, res, next) => {
  try {
    const db = dbOf();
    const payload = buildPayload(req.body);

    // createdAt 설정
    payload.createdAt = new Date();

    await db.collection("resources").insertOne(payload);
    res.set("X-Post-Redirect", "/facet/Job_Vacancies");
    return res.redirect(303, "/facet/Job_Vacancies");
  } catch (e) {
    console.error("POST /job-vacancies error:", e);
    return next(e);
  }
});

/**
 * UPDATE
 * POST /job-vacancies/:id
 *  - 저장소: resources (type='Job_Vacancies') 기준으로 업데이트
 *  - 저장 후: /facet/Job_Vacancies 로 리다이렉트
 */
router.post("/job-vacancies/:id([0-9a-fA-F]{24})", async (req, res, next) => {
  try {
    const db = dbOf();
    let _id;
    try { _id = new mongoose.Types.ObjectId(req.params.id); } catch { return res.status(400).send("Invalid id"); }

    const payload = buildPayload(req.body);
    if ("type" in payload) delete payload.type; // 충돌 방지

    await db.collection("resources").updateOne(
      { _id },
      { $set: payload, $setOnInsert: { createdAt: new Date(), type: "Job_Vacancies" } },
      { upsert: true }
    );

    res.set("X-Post-Redirect", "/facet/Job_Vacancies");
    return res.redirect(303, "/facet/Job_Vacancies");
  } catch (e) {
    console.error("POST /job-vacancies/:id error:", e);
    return next(e);
  }
});

module.exports = router;
