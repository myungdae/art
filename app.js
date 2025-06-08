const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require('express-session');
const userRoutes = require('./router/user');
// const jobRouter = require('./router/job');
const jobSeekerRouter = require('./router/jobSeeker');
const onlineTutorRouter = require('./router/onlineTutor');
const publicRouter = require('./router/public');



require('dotenv').config();
require('./router/config');

const indexRouter = require('./router/index');
const facetRouter = require('./router/facet');
const searchRouter = require('./router/search');
const resourceRouter = require('./router/resource');
const introRouter = require('./router/intro');
const sitemapRouter = require('./router/sitemap');
const dataRouter = require('./router/data');

const connect = require('./model');
const app = express();
connect();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('port', process.env.SVR_BASE_PORT || 8608);

// ✅ 세션 미들웨어는 반드시 라우터보다 먼저!
app.use(session({
  secret: 'esl-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1시간
}));

// body-parser와 static 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// ✅ 현재 페이지 정보를 전역 변수로 사용하기 위한 미들웨어
app.use(function (req, res, next) {
  res.locals.currentPage = req.path;
  next();
});

// ✅ 라우터 등록
app.use('/', indexRouter);
// app.use('/job', jobRouter);
app.use('/job-seekers', jobSeekerRouter);
app.use('/', publicRouter);
app.use('/online-tutor', onlineTutorRouter);
app.use('/pages', indexRouter);
app.use('/facet', facetRouter);
app.use('/search', searchRouter);
app.use('/resource', resourceRouter);
app.use('/intro', introRouter);
app.use('/sitemap', sitemapRouter);
app.use('/data', dataRouter);

// ✅ 사용자 관련 라우터
app.use('/user', userRoutes);

// 404 에러 핸들링
app.use(function (req, res, next) {
  next(createError(404));
});

// 에러 핸들러
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
  next();
});

// 서버 시작
app.listen(app.get('port'), () => {
  console.log(`${app.get('port')}번 포트에서 대기 중`);
});

module.exports = app;
