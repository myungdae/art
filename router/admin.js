// router/admin.js — CommonJS, mounted at /admin
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const VAC  = 'Job_Vacancies';
const SEEK = 'Job_Seekers';
const TUTOR= 'Online_Tutors';

// ----- safe model require -----
function safeRequire(p) { try { return require(p); } catch { return null; } }
const User        = safeRequire('../model/user')        || safeRequire('../models/user');
const JobVacancy  = safeRequire('../model/jobVacancy')  || safeRequire('../models/jobVacancy');
const JobSeeker   = safeRequire('../model/jobSeeker')   || safeRequire('../models/jobSeeker');
const OnlineTutor = safeRequire('../model/onlineTutor') || safeRequire('../models/onlineTutor');

// ----- admin guard (stub) -----
function ensureAdmin(_req, _res, next) { return next(); }

// ----- small utils -----
function setNoCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

// ===== login =====
router.get('/login', (req, res) => {
  setNoCache(res);
  // admin/login 뷰가 있으면 렌더, 없으면 /user/login으로 폴백
  res.render('admin/login', {}, (err, html) => {
    if (err) return res.redirect('/user/login?as=admin');
    res.send(html);
  });
});

// 💡 핵심: 로그인 폼 POST를 받아서 대시보드로 보내기
router.post(['/login', '/signin', '/auth', '/sessions'], (req, res) => {
  setNoCache(res);
  // 여기서 실제 인증이 필요하면 나중에 붙이세요.
  return res.redirect('/admin/dashboard');
});

// 혹시 폼이 /admin/dashboard로 POST해도 케어 (일부 템플릿 가드)
router.post('/dashboard', (_req, res) => res.redirect('/admin/dashboard'));

// /admin → /admin/dashboard 바로 가기
router.get('/', (_req, res) => res.redirect('/admin/dashboard'));

// ===== dashboard =====
router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    const [employers, jobVacancies, jobSeekers, onlineTutors] = await Promise.all([
      User?.find?.({ role: 'employer' }).lean?.() ?? [],
      JobVacancy?.find?.({}).sort?.({ createdAt: -1 }).lean?.() ?? [],
      JobSeeker?.find?.({}).sort?.({ createdAt: -1 }).lean?.() ?? [],
      OnlineTutor?.find?.({}).sort?.({ createdAt: -1 }).lean?.() ?? [],
    ]);

    const toKST = (d) => { try { const t=new Date(d).getTime()+9*3600*1000; return new Date(t).toISOString().replace('T',' ').slice(0,16);} catch {return '';} };

    const employersX    = employers.map(u => ({ ...u, id:String(u._id), createdAtDisplay:toKST(u.createdAt), remainingTokens:u.remainingTokens ?? '' }));
    const jobVacanciesX = jobVacancies.map(j => ({ ...j, id:String(j._id), createdAtDisplay:toKST(j.createdAt), datePostedDisplay:toKST(j.datePosted || j.createdAt) }));
    const jobSeekersX   = jobSeekers.map(j => ({ ...j, id:String(j._id), createdAtDisplay:toKST(j.createdAt), expiresAtDisplay:toKST(j.expiresAt||''), remainingDays:j.remainingDays ?? '' }));
    const onlineTutorsX = onlineTutors.map(t => ({ ...t, id:String(t._id), createdAtDisplay:toKST(t.createdAt), expiresAtDisplay:toKST(t.expiresAt||''), remainingDays:t.remainingDays ?? '' }));

    res.render('admin/dashboard', { employers: employersX, jobVacancies: jobVacanciesX, jobSeekers: jobSeekersX, onlineTutors: onlineTutorsX });
  } catch (e) {
    console.error('[dashboard]', e);
    req.flash?.('error', 'Failed to load dashboard.');
    res.render('admin/dashboard', { employers: [], jobVacancies: [], jobSeekers: [], onlineTutors: [] });
  }
});

// ===== delete + post fallback =====
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
async function safeDelete({ Model, id, label, afterDelete }) {
  if (!Model) throw new Error(`Model missing for ${label}`);
  if (!isValidObjectId(id)) { const e = new Error(`Invalid id for ${label}`); e.status = 400; throw e; }
  const doc = await Model.findById(id);
  if (!doc) { const e = new Error(`${label} not found`); e.status = 404; throw e; }
  await Model.deleteOne({ _id: id });
  if (afterDelete) { try { await afterDelete(doc); } catch (e) { console.warn(`[${label}] afterDelete failed:`, e.message); } }
  return doc;
}
async function removeRdfMirror(baseName, doc) {
  const db = mongoose.connection.db;
  const coll = `${baseName}_RDF`;
  const _id = (doc && doc._id) || null;
  if (!_id) return;
  const oid = typeof _id === 'string' ? new mongoose.Types.ObjectId(_id) : _id;
  await db.collection(coll).deleteOne({ _id: oid });
}
const bindDeleteWithPostFallback = (path, label, Model, afterDelete) => {
  const handler = async (req, res) => {
    try {
      const doc = await safeDelete({ Model, id: req.params.id, label, afterDelete });
      req.flash?.('success', `Deleted ${label.toLowerCase()}: ${doc.username || doc.title || doc.email || doc._id}`);
    } catch (e) {
      req.flash?.('error', e.message || `Failed to delete ${label.toLowerCase()}.`);
    }
    return res.redirect('/admin/dashboard');
  };
  router.delete(path, ensureAdmin, handler);
  router.post(path,  ensureAdmin, handler);
};
const UserModel        = User;
const JobVacancyModel  = JobVacancy;
const JobSeekerModel   = JobSeeker;
const OnlineTutorModel = OnlineTutor;

bindDeleteWithPostFallback('/users/:id', 'User', UserModel, null);
bindDeleteWithPostFallback('/job-vacancies/:id', 'Job Vacancy', JobVacancyModel, async (d) => removeRdfMirror(VAC, d));
bindDeleteWithPostFallback('/job-seekers/:id', 'Job Seeker', JobSeekerModel, async (d) => removeRdfMirror(SEEK, d));
bindDeleteWithPostFallback('/online-tutors/:id', 'Online Tutor', OnlineTutorModel, async (d) => removeRdfMirror(TUTOR, d));

// edit 페이지로 편의 리다이렉트
router.get('/job-vacancies/:id', (req, res) => res.redirect(`/job-vacancies/${req.params.id}/edit`));
router.get('/job-seekers/:id',   (req, res) => res.redirect(`/job-seekers/${req.params.id}/edit`));
router.get('/online-tutors/:id', (req, res) => res.redirect(`/online-tutors/${req.params.id}/edit`));

module.exports = router;
