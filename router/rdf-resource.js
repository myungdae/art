'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/* ---------- helpers ---------- */

// NBSP 제거 + 트림
function cleanHtml(html = '') {
  return (html || '').replace(/\u00A0/g, ' ').trim();
}
function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * GET /rdf-resource/Job_Vacancies/:id
 *  ↳ app.js 에서 app.use('/rdf-resource', rdfResourceRouter) 로 마운트되어 있으므로
 *  ↳ 여기서는 프리픽스 없이 '/Job_Vacancies/:id' 만 적습니다.
 */
router.get('/Job_Vacancies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let _id;

    // id 안전 변환
    try {
      _id = new mongoose.Types.ObjectId(id);
    } catch {
      return res.status(404).send('Invalid id');
    }

    const db = mongoose.connection.db;

    // 1순위: RDF 미러
    let doc = await db.collection('Job_Vacancies_RDF').findOne({ _id });

    // 2순위(백업): 호환 컬렉션
    if (!doc) {
      doc = await db.collection('Job_Vacancies').findOne({ _id });
    }
    if (!doc) return res.status(404).send('Not found');

    // 뷰 모델(화면에 필요한 필드만)
    const vm = {
      id: doc._id.toString(),
      title: (doc._label || doc.title || '').trim(),
      descriptionHtml: cleanHtml(doc._description || doc.description || ''),
      meta: {
        country: doc.country || '',
        studentType: doc.studentType || '',
        teachingAreas: asArray(doc.teachingArea),
        companyName: doc.companyName || '',
        jobLocation: doc.jobLocation || '',
        pay: doc.pay || '',
        housing: doc.housing || '',
        email: doc.email || '',
        homepage: doc.homepage || '',
        datePosted: doc.datePosted ? new Date(doc.datePosted) : null,
      },
      // 디버그용 원본(JSON)은 접이식으로만 노출
      raw: doc,
    };

    return res.render('rdf-resource/jobVacancyShow', { vm });
  } catch (err) {
    console.error('GET /rdf-resource/Job_Vacancies/:id error:', err);
    return next(err);
  }
});

module.exports = router;
