// app.js
"use strict";

require("dotenv").config();

const express        = require("express");
const createError    = require("http-errors");
const path           = require("path");
const session        = require("express-session");
const flash          = require("connect-flash");
const methodOverride = require("method-override");

const connect = require("./model");
const app     = express();

// ── Mailer (optional)
const mailer = require("./utils/mailer");
try { mailer.verify(); } catch (e) {
  console.error("SMTP verify failed at boot:", e?.message || e);
}

// ── Routers
const homeRouter        = require("./router/home");
const userRoutes        = require("./router/user");
const adminRouter       = require("./router/admin");
const inquiryRouter     = require("./router/inquiry");
const policyRouter      = require("./router/policy");
const threadRouter      = require("./router/thread");
const rdfResourceRouter = require("./router/rdf-resource");

console.log("📌 app.js 시작됨 (Art Platform)");
require("./router/config");
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
app.use((req, _res, next) => { console.log(`🔹 ${req.method} ${req.url}`); next(); });

// ── Session  (MemoryStore — MongoDB 권한 불필요)
const SESSION_LIFETIME_MS = parseInt(process.env.SESSION_LIFETIME_DAYS || "7", 10) * 86400 * 1000;

app.set("trust proxy", 1);
app.use(session({
  secret:           process.env.SESSION_SECRET || "art-platform-secret",
  resave:           false,
  saveUninitialized: false,
  rolling:          true,
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

// ── Route mounts  (순서 중요)
app.use("/rdf-resource", rdfResourceRouter);
app.use("/facet",        require("./router/facet"));
app.use("/search",       require("./router/search"));
app.use("/data",         require("./router/data"));
app.use("/policy",       policyRouter);
app.use("/admin",        adminRouter);
app.use("/user",         userRoutes);
app.use("/thread",       threadRouter);
app.use("/",             inquiryRouter);
app.use("/",             homeRouter);          // GET /  — stats 포함 홈
app.use("/",             require("./router/index"));   // /:id/:sub?
app.use("/",             require("./router/public"));  // /pricing 등

// ── 404
app.use((req, res) => {
  res.status(404).render("error", { message: "404 Not Found", error: {} });
});

// ── Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack || err);
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
