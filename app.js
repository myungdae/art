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

const connect = require("./model");
const app = express();

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
const stripeRoutes = require("./router/stripe");
const onlineTutorRouter = require("./router/onlineTutor");
const tutorAccessRouter = require("./router/tutorAccess");
const rdfResourceRouter = require("./router/rdf-resource");
const resourceRouter = require("./router/resource");
const resumeAccessRouter = require("./router/resume-access");
const threadRouter = require("./router/thread");
const inquiryRouter = require("./router/inquiry");
const policyRouter = require("./router/policy");

console.log("📌 app.js 시작됨");
require("./router/config");
connect();
console.log("✅ DB 연결 시도");

// ── App settings
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.set("port", process.env.SVR_BASE_PORT || process.env.PORT || 8608);
app.set("view cache", false);

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

// ── Router mounts
app.use("/resource", resourceRouter);
app.use("/rdf-resource", rdfResourceRouter);

app.use(jobSeekerRouter);
app.use(jobVacancyRouter);
app.use(onlineTutorRouter);

app.use("/policy", policyRouter);
app.use("/stripe", stripeRoutes);
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
