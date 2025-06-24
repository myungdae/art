const express = require('express');
const router = express.Router();
const JobVacancy = require('../model/jobVacancy');
const mongoose = require('mongoose');

// ✅ RDF 변환 함수
function convertJobToRDF(job) {
  const base = 'http://esl.eventpool.kr/resource/';
  const id = job._id.toString();
  const uri = base + job.title.replace(/\s+/g, '_');

  const rdf = {
    '@id': uri,
    '@type': 'Job_Vacancy', 
    'rdfs:label': { '@value': job.title },
    'description': { '@value': job.description || '' },
    'country': { '@value': job.country || '' },
    'studentType': { '@value': job.studentType || '' },
    'teachingArea': [
      { '@id': base + (job.teachingArea || 'Unknown').replace(/\s+/g, '_') }
    ],
    'createdAt': job.createdAt || new Date()
  };

  return rdf;
}

// ✅ /rdf/convert/:id 라우터
router.get('/convert/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const job = await JobVacancy.findById(id);
    if (!job) return res.status(404).send('JobVacancy not found');

    const rdfData = convertJobToRDF(job);

    // ✅ mongoose의 연결을 그대로 사용
    const db = mongoose.connection.db;
    const collection = db.collection('eventpool');

    const existing = await collection.findOne({ '@id': rdfData['@id'] });
    if (existing) {
      await collection.updateOne({ '@id': rdfData['@id'] }, { $set: rdfData });
    } else {
      await collection.insertOne(rdfData);
    }

    res.json(rdfData);
  } catch (err) {
    console.error('RDF Convert Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
