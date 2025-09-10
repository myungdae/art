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

// (선택) 메일러
const mailer = require("./utils/mailer");
try {
  mailer.verify();
} catch (e) {
  console.error("SMTP verify failed at boot:", e?.message || e);
}

// === GLOBAL BUILD MARKER (모든 응답에 헤더 추가) ===
const BUILD = "20250910b";
app.use((req, res, next) => {
  res.set("X-ESL-Build", BUILD);
  next();
});

// === WHOAMI (현재 실행 중인 프로세스/경로/포트 확인용) ===
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

console.log("📌 app.js 시작됨");
require("./router/config");
connect();
console.log("✅ DB 연결 시도");

/* ─────────────────────────────
 * Country 정규화 유틸
 * ───────────────────────────── */
const COUNTRY_CANON = new Map([
  ["KR", "Korea (South)"],
  ["KOREA, REPUBLIC OF (SOUTH KOREA)", "Korea (South)"],
  ["SOUTH KOREA", "Korea (South)"],
  ["REPUBLIC OF KOREA", "Korea (South)"],

  ["US", "United States"],
  ["USA", "United States"],
  ["UNITED STATES OF AMERICA", "United States"],

  ["GB", "United Kingdom"],
  ["UK", "United Kingdom"],
  ["JP", "Japan"],
  ["CN", "China"],
  ["TW", "Taiwan"],
  ["HK", "Hong Kong"],
  ["SG", "Singapore"],
  ["MY", "Malaysia"],
  ["VN", "Vietnam"],
  ["TH", "Thailand"],
  ["PH", "Philippines"],
  ["IN", "India"],
  ["AE", "United Arab Emirates"],
  ["SA", "Saudi Arabia"],
  ["QA", "Qatar"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["CA", "Canada"],
  ["IE", "Ireland"],
]);
function canonCountry(v) {
  if (!v) return "";
  let s = String(v).trim();

  // 2글자 코드 처리
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

/* ─────────────────────────────────────────
 * facet 미러: Job_Vacancies + resources
 * ───────────────────────────────────────── */
async function bestEffortFacetMirror(createdId, src) {
  try {
    const _id = new mongoose.Types.ObjectId(createdId);
    const now = new Date();
    const base = {
      _id,
      title: src.title,
      country: src.country || null,
      date: src.publishedAt || now,
      createdAt: now,
      updatedAt: now,
      status: "published",
      visible: true,
    };
    await mongoose.connection.db
      .collection("Job_Vacancies")
      .updateOne({ _id }, { $set: base }, { upsert: true });
    console.log("[facet mirror] Job_Vacancies upsert:", createdId);

    try {
      await mongoose.connection.db
        .collection("resources")
        .updateOne(
          { _id },
          { $set: { ...base, type: "Job_Vacancies" } },
          { upsert: true }
        );
      console.log("[facet mirror] resources upsert:", createdId);
    } catch (e2) {
      console.warn(
        "[facet mirror] resources upsert skipped:",
        e2.message || e2
      );
    }
  } catch (e) {
    console.warn("[facet mirror] skipped:", e.message || e);
  }
}

/* ─────────────────────────────────────────
 * /job-vacancies/new : 단일 우선순위 핸들러 (HEAD/GET)
 *  - 이 핸들러는 응답을 직접 완료하며 next()를 호출하지 않습니다.
 *  - 라우터 마운트들(app.use(...))보다 '위'에 둡니다.
 * ───────────────────────────────────────── */
app.all("/job-vacancies/new", async (req, res) => {
  res.set("X-NewVac-Handler", "hotfix-20250910");

  // HEAD는 헤더만
  if (req.method === "HEAD") return res.status(200).end();

  const JobVacancy = require("./model/jobVacancy");
  const db = mongoose.connection.db;

  // 사전 컬렉션에서 문자열 배열 뽑기
  async function loadDict(name) {
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

  // 상위 국가(문자열)만 뽑기
  let top = [];
  try {
    const agg = await JobVacancy.aggregate([
      { $match: { country: { $type: "string", $ne: "" } } },
      { $group: { _id: "$country", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 50 },
    ]);
    top = agg
      .map((r) => (r && r._id ? String(r._id) : ""))
      .filter(Boolean);
  } catch {
    top = [];
  }

  const [seedCountries, seedStudentTypes, seedAreas] = await Promise.all([
    loadDict("countries"),
    loadDict("student_types"),
    loadDict("teaching_areas"),
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
      "Korea (South)",
      "United States",
      "Japan",
      "United Kingdom",
      "Canada",
      "Australia",
      "Taiwan",
      "Singapore",
      "Thailand",
      "Vietnam",
    ];
  }

  const studentTypes = (seedStudentTypes.length
    ? seedStudentTypes
    : [
        "Kindergarten",
        "Elementary",
        "Middle School",
        "High School",
        "University",
        "Adult",
        "Corporate",
      ]
  ).map(String);

  const teachingAreas = (seedAreas.length
    ? seedAreas
    : ["ESL", "Conversation", "Test Prep", "Science", "STEM", "Math", "Coding", "English"]
  ).map(String);

  console.log(
    "[/job-vacancies/new] seeds=%d top=%d final=%d",
    seedCountries.length,
    top.length,
    countries.length
  );

  return res.render("jobVacancy/new", {
    pageTitle: "New Job Vacancy (dbg)",
    guestMode: true,
    _countries: countries,
    _studentTypes: studentTypes,
    _teachingAreas: teachingAreas,
    values: {},
    errors: {},
  });
});

// ---- Promo helpers ----
const PROMO_CODE = "yearend2025";
function sendToRegister(roleHint) {
  return (req, res) => {
    const qs = new URLSearchParams({
      promo: PROMO_CODE,
      prefRole: roleHint,
    }).toString();
    return res.redirect(`/user/register?${qs}`);
  };
}

// --- Promo: Employer는 입력창으로 직행 (라우터 마운트보다 '위')
const promoToNewVac = (_req, res) =>
  res.redirect(302, "/job-vacancies/new?source=promo");

// 과거 북마크/네비까지 전부 포착
app.get(
  [
    "/mypage",
    "/mypage-employer",
    "/user/mypage",
    "/user/mypage-employer",
    "/user/employer/plan",
    "/billing/credits",
  ],
  promoToNewVac
);

// 결제도 employer 타입이면 입력창으로
app.get("/paypal/checkout", (req, res, next) => {
  if ((req.query.type || "").toLowerCase() === "employer") {
    return promoToNewVac(req, res);
  }
  return next();
});

// ── App settings
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.set("port", process.env.SVR_BASE_PORT || process.env.PORT || 8608);
app.set("view cache", false);

// ── Parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Method Override
app.use(methodOverride("_method"));

// ── Static
app.use(express.static(path.join(__dirname, "public")));

// ── Request logging
app.use((req, _res, next) => {
  console.log(`🔹 ${req.method} ${req.url}`);
  next();
});

// ── Headers (언어 고정)
app.use((req, res, next) => {
  res.set("Content-Language", "en");
  res.locals.htmlLang = "en";
  next();
});

// ── Session
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: { httpOnly: true, sameSite: "lax", secure: false },
  })
);

// free-now 전역 값
app.use((req, res, next) => {
  res.locals.freeNow = isFreeWindowOpen();
  res.locals.freeUntilStr = FREE_UNTIL
    ? FREE_UNTIL.toISOString().slice(0, 10)
    : null;
  next();
});

// ── Flash & locals
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

// ── Shortcuts
app.get("/login", (_req, res) => res.redirect("/user/login"));

/* Guard: /job-vacancies* 는 게스트 허용 */
app.use((req, res, next) => {
  const isAuth = !!(
    req.session &&
    (req.session.userId || (req.session.user && req.session.user._id))
  );
  const p = req.path;

  const bypassPrefixes = [
    "/user/register",
    "/user/login",
    "/user/logout",
    "/promo",
    "/api",
    "/assets",
    "/public",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap",
    "/search",
    "/intro",
    "/data",
    "/preview",
    "/pay",
    "/policy",
    "/job-vacancies",
  ];
  if (bypassPrefixes.some((x) => p === x || p.startsWith(x))) return next();

  const protectedPrefixes = [
    "/user/mypage",
    "/resume-access",
    "/tutor-access",
    "/billing",
    "/checkout",
    "/paypal",
    "/thread",
    "/admin",
  ];
  if (!isAuth && protectedPrefixes.some((x) => p.startsWith(x))) {
    const promo = req.query.promo || PROMO_CODE;
    const prefRole = req.query.prefRole || "Employer";
    const qs = new URLSearchParams({ promo, prefRole }).toString();
    return res.redirect(`/user/register?${qs}`);
  }
  return next();
});

/* ─────────────────────────────────────────
 * 저장(게스트 허용) — 중복 타이틀 대응 & facet 미러
 * ───────────────────────────────────────── */
app.post(
  ["/job-vacancies/new", "/job-vacancies", "/job-vacancies/create"],
  async (req, res, next) => {
    try {
      const hp = (req.body.hp || "").trim();
      if (hp) return res.status(400).send("Bot suspected.");

      const title = (req.body.title || "").trim();
      const country = canonCountry(req.body.country || "");
      const email = (req.body.email || "").trim().toLowerCase();

      if (!title) {
        // 최소 폼 재표시
        return res.status(400).render("jobVacancy/new", {
          pageTitle: "New Job Vacancy (dbg)",
          guestMode: true,
          errors: { title: "Title is required." },
          values: { title, country, email },

          // 최소 셋도 새 키로
          _countries: normalizeCountries([
            country || "Korea (South)",
            "United States",
            "Japan",
          ]),
          _studentTypes: [
            "Kindergarten",
            "Elementary",
            "Middle School",
            "High School",
            "University",
            "Adults",
            "All Ages",
          ],
          _teachingAreas: [
            "ESL",
            "Conversation",
            "Test Prep",
            "Science",
            "STEM",
            "Math",
            "Coding",
          ],
        });
      }

      const JobVacancy = require("./model/jobVacancy");
      const now = new Date();

      const baseDoc = {
        title,
        country: country || null,
        email: email || null,
        status: "published",
        isPublished: true,
        approved: true,
        isActive: true,
        visible: true,
        publishedAt: now,
        date: now,
        user: null,
        createdBy: { type: "guest", at: now, email: email || null },
        createdAt: now,
        updatedAt: now,
      };

      // teachingAreas[] 처리
      let ta =
        req.body.teachingAreas ||
        req.body["teachingAreas[]"] ||
        req.body.teachingArea ||
        [];
      if (!Array.isArray(ta)) ta = [ta];
      ta = ta.filter(Boolean);
      if (ta.length) baseDoc.teachingAreas = ta;

      if (req.body.studentType)
        baseDoc.studentType = String(req.body.studentType);

      // 저장: 중복 타이틀 대응
      async function saveWithDuplicateFix(doc) {
        try {
          const saved = await new JobVacancy(doc).save();
          return saved._id.toString();
        } catch (e1) {
          if (e1 && (e1.code === 11000 || /E11000/.test(String(e1?.message)))) {
            const suffix = "-" + Date.now().toString(36).slice(-4);
            doc.title = `${doc.title} ${suffix}`;
            try {
              const saved2 = await new JobVacancy(doc).save();
              return saved2._id.toString();
            } catch {
              /* no-op */
            }
          }
        }
        // raw insert fallback
        const ins = await JobVacancy.collection.insertOne(doc);
        return ins.insertedId?.toString?.() || String(ins.insertedId);
      }

      const createdId = await saveWithDuplicateFix({ ...baseDoc });
      console.log("[guest vacancy] saved:", createdId, baseDoc.title);

      // facet 미러
      if (createdId) await bestEffortFacetMirror(createdId, baseDoc);

      // 🔸정식 Facet로 이동
      return res.redirect(302, "/facet/Job_Vacancies");
    } catch (e) {
      console.error("[guest vacancy] fatal error:", e);
      return next(e);
    }
  }
);

/* ─────────────────────────────────────────
 * 디버그/프리뷰 엔드포인트 (JSON 보장)
 * ───────────────────────────────────────── */
app.get("/_debug/facet/job_vacancies", async (_req, res) => {
  try {
    const col = mongoose.connection.db.collection("Job_Vacancies");
    const docs = await col
      .find({})
      .project({ title: 1, country: 1, date: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
app.get("/_debug/facet/resources", async (_req, res) => {
  try {
    const col = mongoose.connection.db.collection("resources");
    const docs = await col
      .find({ type: "Job_Vacancies" })
      .project({ title: 1, country: 1, date: 1, updatedAt: 1, type: 1 })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
app.post("/_debug/facet/rebuild", async (req, res) => {
  try {
    const limit = Math.max(
      1,
      Math.min(500, parseInt(req.query.limit, 10) || 50)
    );
    const JobVacancy = require("./model/jobVacancy");
    const items = await JobVacancy.find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    let mirrored = 0;
    for (const it of items) {
      try {
        await bestEffortFacetMirror(it._id, it);
        mirrored++;
      } catch {}
    }
    res.json({ ok: true, mirrored, total: items.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ── Router mounts (단일핸들러 이후에 마운트)
app.use("/resource", resourceRouter);
app.use("/rdf-resource", rdfResourceRouter);

app.use(jobSeekerRouter);
app.use(jobVacancyRouter);
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

// ✅ user 라우터는 /user에 마운트
app.use("/user", userRoutes);

app.use("/thread", threadRouter);
app.use("/", inquiryRouter);
app.use("/", require("./router/index"));
app.use("/", require("./router/public"));
app.use("/", homeRouter);
app.use("/preview", previewRoutes);

// Portone (한 번만)
app.use("/pay/portone", require("./router/portone"));

// 프로모 경로
app.use("/promo", promoRouter);

// 결제 바로가기 (기존 유지)
app.get("/billing/credits", requireLogin, (req, res) => {
  return res.redirect(302, "/paypal/checkout");
});

// ── 404
app.use((req, res) => {
  res.status(404).render("error", { message: "404 Not Found", error: {} });
});

// ── Error handler
/* eslint-disable no-unused-vars */
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(err.status || 500).render("error", {
    message: err.message,
    error: app.get("env") === "development" ? err : {},
  });
});
/* eslint-enable no-unused-vars */

// ── Start
app.listen(app.get("port"), () => {
  console.log(`✅ Listening on port ${app.get("port")}`);
});

module.exports = app;
