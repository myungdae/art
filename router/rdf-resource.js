// router/rdf-resource.js
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * 1) MongoDB RDF 상세 페이지
 *    /rdf-resource/:klass/:id  → Job_Vacancies_RDF 등에서 _id 로 조회
 */
router.get('/:klass/:id', async (req, res, next) => {
  try {
    const { klass, id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).render('error', { message: 'Invalid id', error: {} });
    }

    const coll = `${klass}_RDF`;
    const db = mongoose.connection.db;

    const doc = await db.collection(coll).findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) {
      return res.status(404).render('error', { message: 'Not found', error: {} });
    }

    const teachingArea = Array.isArray(doc.teachingArea)
      ? doc.teachingArea
      : (doc.teachingArea ? [doc.teachingArea] : []);
    const posted = doc.datePosted ? new Date(doc.datePosted).toISOString().slice(0, 10) : '-';

    return res.render('facet/detail', {
      klass,
      doc: { ...doc, teachingArea },
      posted
    });
  } catch (e) {
    next(e);
  }
});

/**
 * 2) (기존) TTL 파일 뷰어
 *    /rdf-resource/:id  → public/rdf/<id>.ttl 읽어서 출력
 */
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const ttlFilePath = path.join(__dirname, `../public/rdf/${id}.ttl`);

  // 파일 존재 확인
  if (!fs.existsSync(ttlFilePath)) {
    return res.status(404).send('RDF file not found');
  }

  try {
    const ttlContent = fs.readFileSync(ttlFilePath, 'utf-8');
    const lines = ttlContent.split('\n').filter(line => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('@prefix') &&
        !trimmed.startsWith('#')
      );
    });

    const triples = [];
    let currentSubject = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // 주제 시작 (예: res:abc123 a res:JobVacancy;)
      if (/^res:/.test(trimmed)) {
        const parts = trimmed.split(/\s+/);
        currentSubject = parts[0];

        // 나머지 predicate-object 처리
        if (parts.length >= 3) {
          const predicate = parts[1];
          const object = parts.slice(2).join(' ').replace(/[.;]$/, '');
          triples.push({ subject: currentSubject, predicate, object });
        }
      }

      // 줄이 'a res:Something;' 형태면 rdf:type으로 변환
      else if (/^a\s+/.test(trimmed)) {
        const object = trimmed.replace(/^a\s+/, '').replace(/[.;]$/, '');
        triples.push({ subject: currentSubject, predicate: 'rdf:type', object });
      }

      // 이어지는 predicate-object (세미콜론으로 끝날 수 있음)
      else if (/^[a-zA-Z_]+:/.test(trimmed)) {
        const parts = trimmed.split(/\s+/);
        const predicate = parts[0];
        const object = parts.slice(1).join(' ').replace(/[.;]$/, '');
        triples.push({ subject: currentSubject, predicate, object });
      }
    }

    res.render('rdf/detail', { id, triples });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error parsing RDF file');
  }
});

module.exports = router;
