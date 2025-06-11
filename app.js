const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
console.log("📌 app.js 시작됨");
const jobVacancyRouter = require('./router/jobVacancy');
console.log("✅ jobVacancyRouter require 완료");
require('dotenv').config();
console.log("✅ config.js 로드됨");
require('./router/config');

const connect = require('./model');
const app = express();
connect();
console.log("✅ DB 연결 시도");

// ✅ view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', process.env.SVR_BASE_PORT || 8608);

// ✅ 세션 미들웨어 (라우터보다 먼저)
app.use(session({
  secret: 'esl-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1시간
}));

// ✅ body-parser + static
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ 현재 페이지 정보 전역 변수화
app.use(function (req, res, next) {
  res.locals.currentPage = req.path;
  res.locals.session = req.session;
  next();
});

// ✅ 라우터 로딩 (순서 중요)
app.use('/', require('./router/index'));
app.use('/pages', require('./router/index'));
// app.use('/job-seekers', require('./router/jobSeeker'));
app.use('/job-vacancies', jobVacancyRouter);
app.use('/online-tutors', require('./router/onlineTutor'));
app.use('/', require('./router/public'));
app.use('/admin', require('./router/admin'));
app.use('/facet', require('./router/facet'));
app.use('/search', require('./router/search'));
app.use('/resource', require('./router/resource'));
app.use('/intro', require('./router/intro'));
app.use('/sitemap', require('./router/sitemap'));
app.use('/data', require('./router/data'));
app.use('/user', require('./router/user'));

console.log("✅ All routers loaded");

// ✅ 404 핸들링 - 반드시 라우터 다음, 에러 핸들러 전에 위치
app.use(function (req, res, next) {
  res.status(404).render('error', {
    message: '404 Not Found',
    error: req.app.get('env') === 'development' ? {} : {}
  });
});

// ✅ 에러 핸들러
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

// ✅ 서버 실행
app.listen(app.get('port'), () => {
  console.log(`✅ Listening on port ${app.get('port')}`);
});

module.exports = app;
