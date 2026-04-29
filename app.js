// app.js
"use strict";

require("dotenv").config();

// ── 전역 예외 핸들러 — 어떤 에러로 죽는지 로그에 남기고 앱 유지
process.on("uncaughtException",  (err) => {
  console.error("💥 uncaughtException:", err.stack || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 unhandledRejection:", reason?.stack || reason);
});

const express        = require("express");
const path           = require("path");
const session        = require("express-session");
const flash          = require("connect-flash");
const methodOverride = require("method-override");

const connect = require("./model");
const app     = express();

// ── Mailer (optional)
try {
  const mailer = require("./utils/mailer");
  mailer.verify();
} catch (e) {
  console.error("SMTP verify failed at boot:", e?.message || e);
}

// ── Routers (require 실패해도 앱 살아있도록 try-catch)
function safeRequire(p) {
  try { return require(p); }
  catch (e) { console.error("❌ require 실패:", p, e.message); return null; }
}

const homeRouter        = safeRequire("./router/home");
const userRoutes        = safeRequire("./router/user");
const adminRouter       = safeRequire("./router/admin");
const inquiryRouter     = safeRequire("./router/inquiry");
const policyRouter      = safeRequire("./router/policy");
const threadRouter      = safeRequire("./router/thread");
const rdfResourceRouter = safeRequire("./router/rdf-resource");
const facetRouter       = safeRequire("./router/facet");
const searchRouter      = safeRequire("./router/search");
const dataRouter        = safeRequire("./router/data");
const indexRouter       = safeRequire("./router/index");
const publicRouter      = safeRequire("./router/public");

console.log("📌 app.js 시작됨 (Art Platform)");

// config 는 별도 (resetStructure 자동 실행 포함)
try { require("./router/config"); } catch (e) { console.error("config load error:", e.message); }

connect();
console.log("✅ DB 연결 시도");

// ── App settings
app.set("views",       path.join(__dirname, "views"));
app.set("view engine", "pug");
app.set("port",        process.env.SVR_BASE_PORT || process.env.PORT || 8608);
app.set("view cache",  false);

// ── Parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Static
app.use(express.static(path.join(__dirname, "public")));

// ── Method Override
app.use(methodOverride("_method"));

// ── Request logging
app.use((req, _res, next) => {
  console.log(`🔹 ${req.method} ${req.url}`);
  next();
});

// ── Session (MemoryStore — MongoDB 권한 불필요)
const SESSION_LIFETIME_MS = parseInt(process.env.SESSION_LIFETIME_DAYS || "7", 10) * 86400 * 1000;

app.set("trust proxy", 1);
app.use(session({
  secret:            process.env.SESSION_SECRET || "art-platform-secret",
  resave:            false,
  saveUninitialized: false,
  rolling:           true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    maxAge:   SESSION_LIFETIME_MS,
  },
}));

// ── Flash & locals
app.use(flash());
app.use((req, res, next) => {
  res.locals.currentPage   = req.path;
  res.locals.session       = req.session;
  res.locals.message       = req.flash("message")[0];
  res.locals.success       = req.flash("success")[0];
  res.locals.error         = req.flash("error")[0];
  res.locals.siteBrand     = process.env.SITE_BRAND      || "ART+";
  res.locals.siteBrandLink = process.env.SITE_BRAND_LINK || "/";
  res.locals.pageTitle     = res.locals.pageTitle || res.locals.siteBrand;
  next();
});

// ── Shortcuts
app.get("/login", (_req, res) => res.redirect("/user/login"));

// ── Route mounts (null 체크: require 실패한 라우터는 skip)
function useRouter(path, router) {
  if (router) app.use(path, router);
  else console.warn("⚠️  라우터 없음, 건너뜀:", path);
}

useRouter("/rdf-resource", rdfResourceRouter);
useRouter("/facet",        facetRouter);
useRouter("/search",       searchRouter);
useRouter("/data",         dataRouter);
useRouter("/policy",       policyRouter);
useRouter("/admin",        adminRouter);
useRouter("/user",         userRoutes);
useRouter("/thread",       threadRouter);
useRouter("/",             inquiryRouter);
useRouter("/",             homeRouter);
useRouter("/",             indexRouter);
useRouter("/",             publicRouter);

// ── 404
app.use((req, res) => {
  res.status(404).render("error", { message: "404 Not Found", error: {} });
});

// ── Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("🔴 Express error:", err.stack || err);
  res.status(err.status || 500).render("error", {
    message: err.message,
    error:   app.get("env") === "development" ? err : {},
  });
});

// ── Start
app.listen(app.get("port"), () => {
  console.log(`✅ Art Platform listening on port ${app.get("port")}`);
});

module.exports = app;
