const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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
      else if (trimmed.startsWith('a ')) {
        const object = trimmed.slice(2).replace(/[.;]$/, '');
        triples.push({ subject: currentSubject, predicate: 'rdf:type', object });
      }

      // 일반적인 predicate-object 줄
      else if (currentSubject && trimmed.includes(':')) {
        const parts = trimmed.split(/\s+/);
        const predicate = parts[0];
        const object = parts.slice(1).join(' ').replace(/[.;]$/, '');
        triples.push({ subject: currentSubject, predicate, object });
      }
    }

    console.log('✅ Extracted RDF triples:', triples);
    res.render('rdf/view', { triples });

  } catch (err) {
    console.error('❌ Error reading TTL file:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
