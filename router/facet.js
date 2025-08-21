// router/facet.js
'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

function db() {
  return mongoose.connection.db;
}

/**
 * 공통 헬퍼: klass별 조회할 컬렉션 결정
 * - Job_Vacancies는 무조건 Job_Vacancies_RDF 사용
 * - 그 외는 <klass>_RDF 가 존재하면 우선, 없으면 <klass>
 */
async function pickCollection(klass) {
  if (klass === 'Job_Vacancies') return 'Job_Vacancies_RDF';

  const rdf = `${klass}_RDF`;
  const found = await db().listCollections({ name: rdf }).toArray();
  return found.length ? rdf : klass;
}

/**
 * teachingArea 표시용 문자열 생성
 */
function attachDerivedFields(items) {
  items.forEach(d => {
    d.teachingAreaText = Array.isArray(d.teachingArea)
      ? d.teachingArea.join(', ')
      : (d.teachingArea || '');
  });
}

/**
 * Facet 메인
 * 예) /facet/Job_Vacancies
 */
router.get('/:klass', async (req, res, next) => {
  try {
    const { klass } = req.params;

    const collName = await pickCollection(klass);
    const coll = db().collection(collName);

    // _class 필터를 같이 주는 게 가장 안전
    const query = { _class: klass };

    const items = await coll
      .find(query)
      .sort({ datePosted: -1, updatedAt: -1, _id: -1 })
      .limit(200)
      .toArray();

    attachDerivedFields(items);

    // 디버깅용 로그 (원하시면 주석 처리 가능)
    console.log(`[FACET] klass=${klass} coll=${collName} count=${items.length}`);

    return res.render('facet/list', {
      klass,
      items
    });
  } catch (err) {
    console.error('GET /facet/:klass error:', err);
    return next(err);
  }
});

module.exports = router;
