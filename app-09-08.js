// app.js
"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const methodOverride = require("method-override");

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

console.log("📌 app.js 시작됨");
require("./router/config");
connect();
console.log("✅ DB 연결 시도");

// ---- mypage-* 단축 ----
const PROMO_CODE = "yearend2025";
function sendToRegister(roleHint) {
  return (req, res) => {
    const qs = new URLSearchParams({ promo: PROMO_CODE, prefRole: roleHint }).toString();
    return res.redirect(`/user/register?${qs}`);
  };
}
// 비회원도 바로 글쓰기 폼으로
app.get("/mypage-employer", (req, res) => res.redirect(302, "/job-vacancies/new?source=promo"));
app.get("/mypage-jobseeker", sendToRegister("Job Seeker"));
app.get("/mypage-tutor", sendToRegister("Online Tutor"));
// ----------------------

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
  res.locals.freeUntilStr = FREE_UNTIL ? FREE_UNTIL.toISOString().slice(0, 10) : null;
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

/**
 * 비로그인 시 특정 보호 경로는 회원가입으로 유도.
 * 단, /job-vacancies 는 게스트 글쓰기를 허용하므로 우회(bypass)한다.
 */
app.use((req, res, next) => {
  const isAuth =
    !!(req.session && (req.session.userId || (req.session.user && req.session.user._id)));
  const p = req.path;

  // 1) 우회 경로
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
    "/job-vacancies", // ← 게스트 폼/저장 허용
  ];
  if (bypassPrefixes.some((x) => p === x || p.startsWith(x))) return next();

  // 2) 보호 경로
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

// ────────────────────────────────────────────────────────────────
// Guest Job Vacancy quick entry (GET/POST) - 단일 최종 버전
// ────────────────────────────────────────────────────────────────

// 폼 열기 (게스트 최소 입력 폼)
app.get("/job-vacancies/new", (req, res) => {
  return res.render("jobVacancy/new", {
    guestMode: true,
    pageTitle: "Post a Job (Fast)",
  });
});

// 저장 (먼저 mongoose.save; 실패 시 raw insert; facet 미러링은 일단 제외)
app.post(
  ["/job-vacancies/new", "/job-vacancies", "/job-vacancies/create"],
  async (req, res, next) => {
    try {
      const hp = (req.body.hp || "").trim();
      if (hp) return res.status(400).send("Bot suspected.");

      const title = (req.body.title || "").trim();
      const country = (req.body.country || "").trim();
      const email = (req.body.email || "").trim().toLowerCase();

      if (!title) {
        return res.status(400).render("jobVacancy/new", {
          guestMode: true,
          pageTitle: "Post a Job (Fast)",
          errors: { title: "Title is required." },
          values: { title, country, email },
        });
      }

      const JobVacancy = require("./model/jobVacancy");
      const now = new Date();

      // 목록 노출 가능성을 높이는 필드(스키마에 없으면 무시됨)
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

        user: null, // guest
        createdBy: { type: "guest", at: now, email: email || null },
        createdAt: now,
        updatedAt: now,
      };

      // 선택값 수집(있으면)
      const teachingAreas = []
        .concat(req.body.teachingAreas || req.body["teachingAreas[]"] || [])
        .filter(Boolean);
      if (teachingAreas.length) baseDoc.teachingAreas = teachingAreas;
      if (req.body.studentType) baseDoc.studentType = String(req.body.studentType);

      let createdId;
      try {
        // 1) mongoose save (훅/기본값 적용 시도)
        const doc = new JobVacancy(baseDoc);
        const saved = await doc.save();
        createdId = saved._id.toString();
        console.log("[guest vacancy create] saved via mongoose:", createdId, saved.title);
      } catch (e) {
        // 2) 실패 시 raw insert (검증/훅 우회)
        console.warn(
          "[guest vacancy create] mongoose save failed => raw insert fallback:",
          e.message || e
        );
        const ins = await JobVacancy.collection.insertOne(baseDoc);
        createdId = ins.insertedId?.toString?.() || String(ins.insertedId);
        console.log("[guest vacancy create] saved via raw insert:", createdId, baseDoc.title);
      }

      // 저장 후 목록으로 이동
      return res.redirect(302, `/rdf-resource/Job_Vacancies/${createdId}`);
    } catch (e) {
      console.error("[guest vacancy create] error:", e);
      return next(e);
    }
  }
);

// ── Router mounts
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
