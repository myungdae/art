// app.js
"use strict";

require("dotenv").config();

const express = require("express");
const createError = require("http-errors");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const previewRoutes = require("./router/preview");
const connect = require("./model");
const app = express();
const { requireLogin } = require('./middleware/auth');
app.use("/pay/portone", require("./router/portone"));
const { isFreeWindowOpen, FREE_UNTIL } = require('./utils/freeMode');
const promoRouter = require('./router/promo');
const mypageRedirect = require('./router/mypage-redirect');


// Mailer (optional verify)
const mailer = require("./utils/mailer");
try {
  mailer.verify();
} catch (e) {
  console.error("SMTP verify failed at boot:", e?.message || e);
}

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

console.log("📌 app.js 시작됨");
require("./router/config");
connect();
console.log("✅ DB 연결 시도");

// ---- Simple redirects for mypage-* to register (year-end promo) ----
const PROMO_CODE = 'yearend2025';

function sendToRegister(roleHint) {
  return (req, res) => {
    const qs = new URLSearchParams({
      promo: PROMO_CODE,
      prefRole: roleHint,   // 등록 페이지가 역할 카드 미리 선택할 때 힌트로 사용
    }).toString();
    return res.redirect(`/user/register?${qs}`);
  };
}

app.get('/mypage-employer',  sendToRegister('Employer'));
app.get('/mypage-jobseeker', sendToRegister('Job Seeker'));
app.get('/mypage-tutor',     sendToRegister('Online Tutor'));
// -------------------------------------------------------------------


// ── App settings
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.set("port", process.env.SVR_BASE_PORT || process.env.PORT || 8608);
app.set("view cache", false);

// ── Parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Method Override (파서 뒤, 라우터 앞)
app.use(methodOverride("_method"));

// ── Static
app.use(express.static(path.join(__dirname, "public")));

// ── Request logging
app.use((req, _res, next) => {
  console.log(`🔹 ${req.method} ${req.url}`);
  next();
});

// ── Headers
app.use((req, res, next) => {
  res.set("Content-Language", "en");
  next();
});




// ── Session (MUST be before flash)
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

app.use((req, res, next) => {
  res.locals.freeNow = isFreeWindowOpen();
  res.locals.freeUntilStr = FREE_UNTIL ? FREE_UNTIL.toISOString().slice(0,10) : null; // "2025-12-31"
  next();
});

// ── Flash & locals (ONLY once, after session)
app.use(flash());
app.use((req, res, next) => {
  res.locals.currentPage = req.path;
  res.locals.session = req.session;
  res.locals.message = req.flash("message")[0];
  res.locals.success = req.flash("success")[0];
  res.locals.error = req.flash("error")[0];
  res.locals.showPayment = req.flash("showPayment")[0] === "true";

  // Global brand for header/title
  res.locals.siteBrand = process.env.SITE_BRAND || "ESL Plus";
  res.locals.siteBrandLink = process.env.SITE_BRAND_LINK || "/";
  res.locals.pageTitle = res.locals.pageTitle || res.locals.siteBrand;
  next();
});

// ── Shortcuts
app.get("/login", (_req, res) => res.redirect("/user/login"));

// ── Router mounts (순서 중요하지 않은 특이 케이스 제외)
app.use('/', mypageRedirect);
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
app.use("/user", userRoutes);
app.use("/thread", threadRouter);
app.use("/", inquiryRouter);
app.use("/", require("./router/index"));
app.use("/", require("./router/public"));
app.use("/", homeRouter);
app.use("/preview", previewRoutes);
app.use("/pay/portone", require("./router/portone"));
app.use('/promo', promoRouter);

// force English site-wide
app.use((req, res, next) => {
  res.setHeader('Content-Language', 'en');
  res.locals.htmlLang = 'en'; // 뷰 <html lang="...">에 사용
  next();
});

app.get('/billing/credits', requireLogin, (req, res) => {
  return res.redirect(302, '/paypal/checkout');
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
