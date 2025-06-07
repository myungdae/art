const createError = require('http-errors');
const express = require('express');
const path = require('path');
const userRoutes = require('./router/user'); 

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

app.use(express.json());
app.use(express.urlencoded({ extended:false}));
app.use(express.static(path.join(__dirname, 'public')));

/* 현재 페이지 정보를 전역변수로 사용하기 위한 미들웨어 */
app.use(function(req, res, next) {
    res.locals.currentPage = req.path;
    next();
});

app.use('/', indexRouter);
app.use('/pages', indexRouter);
app.use('/facet', facetRouter);
app.use('/search', searchRouter);
app.use('/resource', resourceRouter);
app.use('/intro', introRouter);
app.use('/sitemap', sitemapRouter);
app.use('/data', dataRouter);

// ✅ 사용자 라우터 등록
app.use('/user', userRoutes);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});
// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
    next();
});

app.listen(app.get('port'), () => {
    console.log(`${app.get('port')}번 포트에서 대기 중`);
});
module.exports = app;
