// app.js
"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const mongoose = require("mongoose");

const connect = require("./model");
const app = express();

const { requireLogin } = require("./middleware/auth");
const { isFreeWindowOpen, FREE_UNTIL } = require("./utils/freeMode");

// Routers
const homeRouter = require("./router/home");
const userRoutes = require("./router/user");
const adminRouter = require("./router/admin");
const jobVacancyRouter = require("./router/jobVacancy");
const jobSeekerRouter = require("./router/jobSeeker");
const paypalRoutes = require("./router/paypal");
const onlineTutorRouter = require("./router/onlineTutor");
const tutorAccessRouter = require("./router/tutorAccess");
const rdfResourceRouter = require("./router/rdf-resource");
const resourceRouter = require("./router/resource");
const resumeAccessRouter = require("./router/resume-access");
const threadRouter = require("./router/thread");
const inquiryRouter = require("./router/inquiry");
const policyRouter = require("./router/policy");
const nationalitiesRoutes = require("./router/nationalities");
const previewRoutes = require("./router/preview");
const promoRouter = require("./router/promo");

/* ─────────────────────────────────────────
 * 공통 유틸
 * ───────────────────────────────────────── */
const A = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
const S = (s) => (typeof s === "string" ? s.trim() : "");

/** 제목 영어(ASCII)만 허용 */
function titleLooksEnglish(title) {
  if (!title) return false;
  // U+0000 ~ U+007F 범위만 허용 (개행 제외)
  return /^[\u0020-\u007E]+$/.test(title);
}

/* ─────────────────────────────────────────
 * 0) 파서 (반드시 라우트보다 위)
 * ───────────────────────────────────────── */
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));

/* ─────────────────────────────────────────
 * 1) Mongo 연결 및 db 주입
 * ───────────────────────────────────────── */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventpool";

if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(MONGO_URI, { dbName: "eventpool" })
    .catch((err) => console.error("Mongoose connect error:", err));
}

mongoose.connection.on("connected", () => {
  app.locals.db = mongoose.connection.db;
  console.log("[DB] connected and app.locals.db set");
});

/* (선택) 메일러 */
const mailer = require("./utils/mailer");
try { mailer.verify(); } catch (e) { console.error("SMTP verify failed at boot:", e?.message || e); }

/* ─────────────────────────────────────────
 * 2) 전역 빌드 마커
 * ───────────────────────────────────────── */
const BUILD = "20250912-title-en-only";
app.use((req, res, next) => {
  res.set("X-ESL-Build", BUILD);
  next();
});

app.get(
  ["/user/mypage", "/mypage", "/mypage-employer", "/user/mypage-employer"],
  (_req, res) => res.redirect(302, "/job-vacancies/new")
);

/* ─────────────────────────────────────────
 * 3) 디버그 라우트
 * ───────────────────────────────────────── */
app.get("/__whoami", (req, res) => {
  res.json({
    build: BUILD,
    pid: process.pid,
    cwd: process.cwd(),
    main: (require.main && require.main.filename) || null,
    appDir: __dirname,
    port_app: app.get("port"),
    env_PORT: process.env.PORT || null,
    env_SVR_BASE_PORT: process.env.SVR_BASE_PORT || null,
    node: process.version,
    method: req.method,
  });
});
app.get("/_debug/ping", (_req, res) => res.json({ ok: true, where: "app.js ok" }));
app.post("/_debug/echo", (req, res) => res.json({ ok: true, body: req.body, ct: req.headers["content-type"] || null }));

/* ─────────────────────────────────────────
 * 4) Job Vacancies — 저장(우선순위 최상단)
 * ───────────────────────────────────────── */
function buildVacancyPayload(b = {}) {
  return {
    type: "Job_Vacancies", // CREATE에서만 실제 쓰임. UPDATE에서는 $setOnInsert로만 지정
    title: S(b.title),
    country: S(b.country) || S(b?.location?.country),
    description: S(b.description) || S(b.desc) || S(b.jobDescription),

    studentType: A(b.studentType || b["studentType[]"] || b.Student_Type || b["Student_Type[]"]),
    teachingArea: A(b.teachingArea || b["teachingArea[]"] || b.Teaching_Area || b["Teaching_Area[]"]),

    languages: A(b.languages || b.language || b["languages[]"] || b["language[]"]),
    companyName: S(b.companyName || b.schoolName),
    jobLocation: S(b.jobLocation || b.location || b.city),
    pay: S(b.pay),
    housing: S(b.housing),
    email: S(b.email),
    homepage: S(b.homepage || b.website),

    status: S(b.status) || "published",
    visible: b.visible !== "false",
    updatedAt: new Date(),
  };
}

/* ─────────────────────────────────────────
 * 4-1) 폼 seed 로딩 + 렌더 헬퍼 (GET/POST 공용)
 * ───────────────────────────────────────── */
const COUNTRY_CANON = new Map([
  ["KR", "Korea (South)"], ["KOREA, REPUBLIC OF (SOUTH KOREA)", "Korea (South)"], ["SOUTH KOREA", "Korea (South)"], ["REPUBLIC OF KOREA", "Korea (South)"],
  ["US", "United States"], ["USA", "United States"], ["UNITED STATES OF AMERICA", "United States"],
  ["GB", "United Kingdom"], ["UK", "United Kingdom"], ["JP", "Japan"], ["CN", "China"], ["TW", "Taiwan"], ["HK", "Hong Kong"],
  ["SG", "Singapore"], ["MY", "Malaysia"], ["VN", "Vietnam"], ["TH", "Thailand"], ["PH", "Philippines"], ["IN", "India"],
  ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["QA", "Qatar"], ["AU", "Australia"], ["NZ", "New Zealand"],
  ["CA", "Canada"], ["IE", "Ireland"],
]);
function canonCountry(v) {
  if (!v) return "";
  let s = String(v).trim();
  if (/^[A-Za-z]{2}$/.test(s)) {
    const up = s.toUpperCase();
    if (COUNTRY_CANON.has(up)) return COUNTRY_CANON.get(up);
    return up;
  }
  const upper = s.toUpperCase();
  if (COUNTRY_CANON.has(upper)) return COUNTRY_CANON.get(upper);
  return s;
}
function normalizeCountries(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    let v = raw;
    if (v && typeof v === "object") v = v.name || v.code || "";
    v = canonCountry(v);
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function loadDict(db, name) {
  try {
    const exists = await db.listCollections({ name }).toArray();
    if (!exists.length) return [];
    const rows = await db
      .collection(name)
      .find({}, { projection: { _id: 0, name: 1, code: 1 } })
      .sort({ name: 1 })
      .limit(1000)
      .toArray();
    return rows
      .map((x) => (x && (x.name || x.code) ? String(x.name || x.code) : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function renderNewForm(req, res, values = {}, errors = {}) {
  const JobVacancy = require("./model/jobVacancy");
  const db = req.app.locals.db || mongoose.connection.db;

  // 상위 국가(문자열)만 뽑기
  let top = [];
  try {
    const agg = await JobVacancy.aggregate([
      { $match: { country: { $type: "string", $ne: "" } } },
      { $group: { _id: "$country", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 50 },
    ]);
    top = agg.map((r) => (r && r._id ? String(r._id) : "")).filter(Boolean);
  } catch {
    top = [];
  }

  const [seedCountries, seedStudentTypes, seedAreas] = await Promise.all([
    loadDict(db, "countries"),
    loadDict(db, "student_types"),
    loadDict(db, "teaching_areas"),
  ]);

  let countries = normalizeCountries([
    ...seedCountries,
    ...top,
    "Korea (South)",
    "United States",
    "Japan",
    "United Kingdom",
    "Canada",
    "Australia",
  ]);
  if (!countries.length) {
    countries = [
      "Korea (South)", "United States", "Japan", "United Kingdom",
      "Canada", "Australia", "Taiwan", "Singapore", "Thailand", "Vietnam",
    ];
  }

  const studentTypes = (seedStudentTypes.length
    ? seedStudentTypes
    : ["Kindergarten","Elementary","Middle School","High School","University","Adult","Corporate"]
  ).map(String);

  const teachingAreas = (seedAreas.length
    ? seedAreas
    : ["ESL","Conversation","Test Prep","Science","STEM","Math","Coding","English"]
  ).map(String);

  return res.render("jobVacancy/new", {
    pageTitle: "New Job Vacancy",
    guestMode: true,
    _countries: countries,
    _studentTypes: studentTypes,
    _teachingAreas: teachingAreas,
    values: values || {},
    errors: errors || {},
  });
}

/* ─────────────────────────────────────────
 * CREATE (서버 측 검증 포함)
 * ───────────────────────────────────────── */
async function createOrInsert(req, res, next) {
  try {
    const db = req.app.locals.db || mongoose.connection.db;
    if (!db) return res.status(503).send("DB not ready");

    const payload = buildVacancyPayload(req.body);

    // 서버측 유효성 검사: 제목 영어(ASCII)만
    const errors = {};
    if (!payload.title) {
      errors.title = "Title is required.";
    } else if (!titleLooksEnglish(payload.title)) {
      errors.title = "Title must be English (ASCII only).";
    }

    if (Object.keys(errors).length) {
      return renderNewForm(req, res, req.body, errors);
    }

    payload.createdAt = new Date();
    const r = await db.collection("resources").insertOne(payload);
    return res.redirect(`/rdf-resource/Job_Vacancies/${r.insertedId}`);
  } catch (e) {
    console.error("[CREATE] /job-vacancies error:", e);
    return next(e);
  }
}

// 두 경로 모두 허용 (기존 폼 호환)
app.post("/job-vacancies", createOrInsert);
app.post("/job-vacancies/create", createOrInsert);

/* ─────────────────────────────────────────
 * UPDATE: /job-vacancies/:id (24자리 ObjectId만 매칭)
 *  - 제목 영어(ASCII) 검증 포함
 * ───────────────────────────────────────── */
app.post("/job-vacancies/:id([0-9a-fA-F]{24})", async (req, res, next) => {
  try {
    const db = req.app.locals.db || (mongoose.connection && mongoose.connection.db);
    if (!db) return res.status(503).send("DB not ready");

    let _id;
    try {
      _id = new mongoose.Types.ObjectId(req.params.id);
    } catch {
      return res.status(400).send("Invalid id");
    }

    const payload = buildVacancyPayload(req.body);

    // 제목 영어(ASCII) 검증 (제목을 수정하려는 경우만 체크)
    if (payload.title && !titleLooksEnglish(payload.title)) {
      req.flash("error", "Title must be English (ASCII only).");
      return res.redirect(`/rdf-resource/Job_Vacancies/${_id.toString()}`);
    }

    if ("type" in payload) delete payload.type; // 업데이트에서 type 충돌 방지

    await db.collection("resources").updateOne(
      { _id },
      {
        $set: payload,
        $setOnInsert: { createdAt: new Date(), type: "Job_Vacancies" },
      },
      { upsert: true }
    );

    return res.redirect(`/rdf-resource/Job_Vacancies/${_id.toString()}`);
  } catch (e) {
    console.error("[UPDATE] /job-vacancies/:id error:", e);
    return next(e);
  }
});

/* ─────────────────────────────────────────
 * 6) /job-vacancies/new (입력 화면)
 * ───────────────────────────────────────── */
app.all("/job-vacancies/new", async (req, res) => {
  res.set("X-NewVac-Handler", "title-en-only");
  if (req.method === "HEAD") return res.status(200).end();
  console.log("[/job-vacancies/new] page render");
  return renderNewForm(req, res, {}, {});
});

/* ─────────────────────────────────────────
 * 8) 앱 설정/미들웨어
 * ───────────────────────────────────────── */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.set("port", process.env.SVR_BASE_PORT || process.env.PORT || 8608);
app.set("view cache", false);

app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, _res, next) => {
  console.log(`🔹 ${req.method} ${req.url}`);
  next();
});
app.use((req, res, next) => {
  res.set("Content-Language", "en");
  res.locals.htmlLang = "en";
  next();
});

app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || MONGO_URI,
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: { httpOnly: true, sameSite: "lax", secure: false },
  })
);

app.use(flash());
app.use((req, res, next) => {
  res.locals.currentPage = req.path;
  res.locals.session = req.session;
  res.locals.message = req.flash("message")[0];
  res.locals.success = req.flash("success")[0];
  res.locals.error = req.flash("error")[0];
  res.locals.showPayment = req.flash("showPayment")[0] === "true";
  res.locals.siteBrand = process.env.SITE_BRAND || "ESL Plus";
  res.locals.siteBrandLink = process.env.SITE_BRAND_LINK || "/";
  res.locals.pageTitle = res.locals.pageTitle || res.locals.siteBrand;
  next();
});

/* ── ✅ 프로모션 전역 로컬 주입 (자동 노출/문구 날짜용) ── */
app.use((req, res, next) => {
  try {
    res.locals.freeNow = isFreeWindowOpen(); // true면 home.pug에서 data-free-open="1"
    res.locals.freeUntilStr = FREE_UNTIL ? FREE_UNTIL.toISOString().slice(0,10) : '';
  } catch (_) {
    res.locals.freeNow = false;
    res.locals.freeUntilStr = '';
  }
  next();
});

// Shortcuts
app.get("/login", (_req, res) => res.redirect("/user/login"));

/* Guard: /job-vacancies* 는 게스트 허용 */
app.use((req, res, next) => {
  const isAuth = !!(req.session && (req.session.userId || (req.session.user && req.session.user._id)));
  const p = req.path;

  const bypassPrefixes = [
    "/user/register","/user/login","/user/logout",
    "/promo","/api","/assets","/public","/favicon.ico","/robots.txt",
    "/sitemap","/search","/intro","/data","/preview","/pay","/policy",
    "/job-vacancies"
  ];
  if (bypassPrefixes.some((x) => p === x || p.startsWith(x))) return next();

  const protectedPrefixes = ["/user/mypage","/resume-access","/tutor-access","/billing","/checkout","/paypal","/thread","/admin"];
  if (!isAuth && protectedPrefixes.some((x) => p.startsWith(x))) {
    const promo = req.query.promo || "yearend2025";
    const prefRole = req.query.prefRole || "Employer";
    const qs = new URLSearchParams({ promo, prefRole }).toString();
    return res.redirect(`/user/register?${qs}`);
  }
  return next();
});

/* ─────────────────────────────────────────
 * 9) 홈 스피너 API
 * ───────────────────────────────────────── */
app.get("/api/home/stats", async (_req, res) => {
  const db = app.locals.db || mongoose.connection.db;
  const out = { Job_Vacancies: 0, Job_Seekers: 0, Online_Tutors: 0 };

  try {
    const types = ["Job_Vacancies", "Job_Seekers", "Online_Tutors"];
    const agg = await db.collection("resources").aggregate([
      { $match: { type: { $in: types } } },
      { $group: { _id: "$type", c: { $sum: 1 } } },
    ]).toArray();

    for (const row of agg) out[row._id] = row.c || 0;

    res.set("X-Home-Stats-Source", "mirror:resources");
    res.set("Cache-Control", "no-store");
    return res.json({ ...out, vCount: out.Job_Vacancies, sCount: out.Job_Seekers, tCount: out.Online_Tutors });
  } catch (e) {
    try {
      const infos = await db.listCollections().toArray();
      const getName = (re) => (infos.find((ci) => re.test(ci.name)) || {}).name;

      const mainJV = getName(/job.?vacanc/i);
      const mainJS = getName(/job.?seek/i);
      const mainOT = getName(/online.?tutor/i);

      if (mainJV) out.Job_Vacancies = await db.collection(mainJV).countDocuments({});
      if (mainJS) out.Job_Seekers = await db.collection(mainJS).countDocuments({});
      if (mainOT) out.Online_Tutors = await db.collection(mainOT).countDocuments({});

      res.set("X-Home-Stats-Source", "fallback:legacy-collections");
      res.set("Cache-Control", "no-store");
      return res.json({ ...out, vCount: out.Job_Vacancies, sCount: out.Job_Seekers, tCount: out.Online_Tutors });
    } catch {
      res.set("X-Home-Stats-Source", "error");
      res.set("Cache-Control", "no-store");
      return res.json({ ...out, vCount: 0, sCount: 0, tCount: 0 });
    }
  }
});

/* ─────────────────────────────────────────
 * 10) 디버그/프리뷰 (db 안전 참조)
 * ───────────────────────────────────────── */
app.get("/_debug/facet/job_vacancies", async (_req, res) => {
  try {
    const col = (app.locals.db || mongoose.connection.db).collection("Job_Vacancies");
    const docs = await col.find({})
      .project({ title: 1, country: 1, date: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(50).toArray();
    res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
app.get("/_debug/facet/resources", async (_req, res) => {
  try {
    const col = (app.locals.db || mongoose.connection.db).collection("resources");
    const docs = await col.find({ type: "Job_Vacancies" })
      .project({ title: 1, country: 1, date: 1, updatedAt: 1, type: 1 })
      .sort({ updatedAt: -1 })
      .limit(50).toArray();
    res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ─────────────────────────────────────────
 * 11) 라우터 마운트
 * ───────────────────────────────────────── */
app.use("/resource", resourceRouter);
app.use("/rdf-resource", rdfResourceRouter);

app.use(jobSeekerRouter);
app.use("/", jobVacancyRouter);
app.use(onlineTutorRouter);

app.use("/policy", policyRouter);
app.use("/paypal", paypalRoutes);
app.use("/api/nationalities", nationalitiesRoutes);
app.use("/resume-access", resumeAccessRouter);
app.use("/tutor-access", tutorAccessRouter);
app.use("/admin", adminRouter);
app.use("/facet", require("./router/facet"));
app.use("/search", require("./router/search"));
app.use("/intro", require("./router/intro"));
app.use("/sitemap", require("./router/sitemap"));
app.use("/data", require("./router/data"));

app.use("/user", userRoutes);

app.use("/thread", threadRouter);
app.use("/", inquiryRouter);
app.use("/", require("./router/index"));
app.use("/", require("./router/public"));
app.use("/", homeRouter);
app.use("/preview", previewRoutes);

app.use("/pay/portone", require("./router/portone"));

app.use("/promo", promoRouter);

// ---- Health checks (JSON) ----
// (404 핸들러보다 위에 위치해야 합니다)
app.get("/healthz", (req, res) => {
  const mongoReady = (mongoose.connection && mongoose.connection.readyState) === 1;
  res.type("application/json").status(mongoReady ? 200 : 503).json({
    ok: mongoReady,
    build: BUILD,
    env: process.env.NODE_ENV || "development",
    now: new Date().toISOString(),
  });
});
app.get("/livez", (_req, res) => res.json({ ok: true }));
app.get("/readyz", (_req, res) => {
  const mongoReady = (mongoose.connection && mongoose.connection.readyState) === 1;
  res.status(mongoReady ? 200 : 503).json({ ok: mongoReady });
});

/* 404 */
app.use((req, res) => {
  res.status(404).render("error", { message: "404 Not Found", error: {} });
});

/* Error handler */
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(err.status || 500).render("error", {
    message: err.message,
    error: app.get("env") === "development" ? err : {},
  });
});

/* Start */
app.listen(app.get("port"), () => {
  console.log(`✅ Listening on port ${app.get("port")}`);
});

module.exports = app;
