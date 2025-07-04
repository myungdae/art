const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  let filterQuery = { "@type": facetType };

  // 👉 여러 filter 쿼리 지원
  const filters = {};
  if (req.query.hostCountry) filters.hostCountry = req.query.hostCountry;
  if (req.query.studentType) filters.studentType = req.query.studentType;
  if (req.query.teachingArea) filters.teachingArea = req.query.teachingArea;
  Object.assign(filterQuery, filters);

  const data = await col.find(filterQuery).toArray();

  const facets = await col.aggregate([
    { $match: { "@type": facetType } },
    {
      $facet: {
        hostCountry: [
          { $group: { _id: "$hostCountry", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        studentType: [
          { $group: { _id: "$studentType", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        teachingArea: [
          { $group: { _id: "$teachingArea", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      }
    }
  ]).toArray();

  res.render('facet', {
    data,
    filters: [
      {
        name: 'hostCountry',
        display: 'Host Country',
        options: facets[0].hostCountry.map(f => ({
          label: f._id || 'N/A',
          value: f._id || '',
          count: f.count
        }))
      },
      {
        name: 'studentType',
        display: 'Student Type',
        options: facets[0].studentType.map(f => ({
          label: f._id || 'N/A',
          value: f._id || '',
          count: f.count
        }))
      },
      {
        name: 'teachingArea',
        display: 'Teaching Area',
        options: facets[0].teachingArea.map(f => ({
          label: f._id || 'N/A',
          value: f._id || '',
          count: f.count
        }))
      }
    ]
  });

});  // router.get 닫는 중괄호 추가

module.exports = router;
