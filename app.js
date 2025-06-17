const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();
const userRoutes = require('./router/user');
const methodOverride = require('method-override');



console.log("📌 app.js 시작됨");

const jobVacancyRouter = require('./router/jobVacancy');
const jobSeekerRouter = require('./router/jobSeeker');
const paypalRoutes = require('./router/paypal');

console.log("✅ 라우터 require 완료");
require('./router/config');

const connect = require('./model');
const app = express();
connect();
console.log("✅ DB 연결 시도");

// ✅ view engine 설정
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', process.env.SVR_BASE_PORT || 8608);

// ✅ 세션 미들웨어 (flash보다 먼저)
app.use(session({
  secret: 'esl-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1시간
}));

// ✅ flash 미들웨어 (세션 다음)
app.use(flash());

// ✅ 현재 요청 정보 전역 변수화
app.use((req, res, next) => {
  res.locals.currentPage = req.path;
  res.locals.session = req.session;
  res.locals.message = req.flash('message')[0];
  res.locals.showPayment = req.flash('showPayment')[0] === 'true';
  next();
});

// ✅ body-parser + 정적 파일
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method')); 

// ✅ 라우터 등록
app.use('/', require('./router/index'));
app.use('/pages', require('./router/index'));
app.use('/job-seekers', jobSeekerRouter);
app.use('/paypal', paypalRoutes);
app.use('/job-vacancies', jobVacancyRouter); // 반드시 이 위치
app.use('/online-tutors', require('./router/onlineTutor'));
app.use('/', require('./router/public'));
app.use('/', userRoutes);
app.use('/admin', require('./router/admin'));
app.use('/facet', require('./router/facet'));
app.use('/search', require('./router/search'));
app.use('/resource', require('./router/resource'));
app.use('/intro', require('./router/intro'));
app.use('/sitemap', require('./router/sitemap'));
app.use('/data', require('./router/data'));
app.use('/user', require('./router/user'));

console.log("✅ All routers loaded");

// ✅ 404 핸들링
app.use((req, res, next) => {
  res.status(404).render('error', {
    message: '404 Not Found',
    error: req.app.get('env') === 'development' ? {} : {}
  });
});

// ✅ 에러 핸들러
app.use((err, req, res, next) => {
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
