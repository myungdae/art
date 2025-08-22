// app.js (cleaned & production-oriented)
'use strict';

require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const connect = require('./model');
const app = express();

// --- Mailer (verify on boot) ---
const mailer = require('./utils/mailer');
try {
  mailer.verify(); // ✅ 부팅 시 SMTP 연결 확인 로그
} catch (e) {
  console.error('SMTP verify failed at boot:', e?.message || e);
}

// --- Routers ---
const homeRouter = require('./router/home');
const userRoutes = require('./router/user');
const adminRouter = require('./router/admin');
const jobVacancyRouter = require('./router/jobVacancy');
const jobSeekerRouter = require('./router/jobSeeker');
const paypalRoutes = require('./router/paypal');
const onlineTutorRouter = require('./router/onlineTutor');
const tutorAccessRouter = require('./router/tutorAccess');
const rdfResourceRouter = require('./router/rdf-resource');
const resourceRouter = require('./router/resource');
const resumeAccessRouter = require('./router/resume-access');
const threadRouter = require('./router/thread');
const inquiryRouter = require('./router/inquiry'); // ✅ Inquiry

console.log('📌 app.js 시작됨');
require('./router/config'); // 환경/전역 라우터 설정 등
connect();
console.log('✅ DB 연결 시도');

// --- App settings ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', process.env.SVR_BASE_PORT || process.env.PORT || 8608);
app.set('view cache', false);

// --- Parsers (CKEditor 대비 살짝 상향) ---
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// --- Static ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Method Override (폼용) ---
app.use(methodOverride('_method'));

// --- Request logging (simple) ---
app.use((req, _res, next) => {
  console.log(`🔹 ${req.method} ${req.url}`);
  next();
});

// --- Content language header (default: en) ---
app.use((req, res, next) => {
  res.set('Content-Language', 'en');
  next();
});

// --- Session (MongoStore) ---
app.set('trust proxy', 1); // Nginx 등 프록시 뒤면 권장
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,         // ⬅️ 필수: .env에 설정
    ttl: 14 * 24 * 60 * 60,                  // 14일
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // HTTPS 프록시 환경이면 true + app.set('trust proxy', 1)
  },
}));

// --- Flash & locals (session 이후) ---
app.use(flash());
app.use((req, res, next) => {
  res.locals.currentPage = req.path;
  res.locals.session = req.session;
  res.locals.message = req.flash('message')[0];
  res.locals.success = req.flash('success')[0];
  res.locals.error = req.flash('error')[0];
  res.locals.showPayment = req.flash('showPayment')[0] === 'true';
  next();
});

// --- Shortcuts ---
app.get('/login', (_req, res) => res.redirect('/user/login'));

// --- Router mounts ---
app.use('/resource', resourceRouter);
app.use('/rdf-resource', rdfResourceRouter);

// 절대경로 라우터 (베이스 없이)
app.use(jobSeekerRouter);          // /job-seekers/...
app.use(jobVacancyRouter);         // /job-vacancies/...
app.use(onlineTutorRouter);        // /online-tutors/...

app.use('/paypal', paypalRoutes);
app.use('/resume-access', resumeAccessRouter);
app.use('/tutor-access', tutorAccessRouter);
app.use('/admin', adminRouter);
app.use('/facet', require('./router/facet'));
app.use('/search', require('./router/search'));
app.use('/intro', require('./router/intro'));
app.use('/sitemap', require('./router/sitemap'));
app.use('/data', require('./router/data'));
app.use('/user', userRoutes);
app.use('/thread', threadRouter);
app.use('/', inquiryRouter);       // ✅ Inquiry (GET/POST /inquiry)
app.use('/', require('./router/index'));
app.use('/', require('./router/public'));
app.use('/', homeRouter);

// --- 404 handler ---
app.use((req, res, _next) => {
  res.status(404).render('error', {
    message: '404 Not Found',
    error: app.get('env') === 'development' ? {} : {}
  });
});

// --- Error handler ---
/* eslint-disable no-unused-vars */
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(err.status || 500).render('error', {
    message: err.message,
    error: app.get('env') === 'development' ? err : {}
  });
});
/* eslint-enable no-unused-vars */

// --- Start server ---
app.listen(app.get('port'), () => {
  console.log(`✅ Listening on port ${app.get('port')}`);
});

module.exports = app;
