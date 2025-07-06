const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();
const methodOverride = require('method-override');

const connect = require('./model');
const app = express();

// 📌 라우터
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

console.log("📌 app.js 시작됨");
require('./router/config');
connect();
console.log("✅ DB 연결 시도");

app.get('/login', (req, res) => {
  return res.redirect('/user/login');
});

// 📌 view 설정
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', process.env.SVR_BASE_PORT || 8608);
app.set('view cache', false);

// 📌 미들웨어
app.use(session({
  secret: 'esl-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 }
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.currentPage = req.path;
  res.locals.session = req.session;
  res.locals.message = req.flash('message')[0];
  res.locals.showPayment = req.flash('showPayment')[0] === 'true';
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// 요청 로깅
app.use((req, res, next) => {
  console.log(`🔹 ${req.method} ${req.url}`);
  next();
});

// 📌 라우터 등록
app.use('/resource', resourceRouter);
app.use('/rdf-resource', rdfResourceRouter);
app.use('/job-seekers', jobSeekerRouter);     // ✅ JobSeeker router는 /job-seekers 접두사
app.use('/job-vacancies', jobVacancyRouter);
app.use('/paypal', paypalRoutes);
app.use('/resume-access', resumeAccessRouter);
app.use('/online-tutor', onlineTutorRouter);
app.use('/tutor-access', tutorAccessRouter);
app.use('/admin', adminRouter);
app.use('/facet', require('./router/facet'));
app.use('/search', require('./router/search'));
app.use('/intro', require('./router/intro'));
app.use('/sitemap', require('./router/sitemap'));
app.use('/data', require('./router/data'));
app.use('/user', userRoutes);
app.use('/', require('./router/index'));
app.use('/', require('./router/public'));

// 📌 404 핸들링
app.use((req, res, next) => {
  res.status(404).render('error', {
    message: '404 Not Found',
    error: req.app.get('env') === 'development' ? {} : {}
  });
});

// 📌 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

// 📌 서버 시작
app.listen(app.get('port'), () => {
  console.log(`✅ Listening on port ${app.get('port')}`);
});

module.exports = app;
