const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = 'esl';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filter = req.query.filter;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  let filterQuery = { "@type": facetType };
  if (filter) {
    filterQuery = {
      ...filterQuery,
      $or: [
        { hostCountry: filter },
        { studentType: filter },
        { teachingArea: filter }
      ]
    };
  }

  const data = await col.find(filterQuery).toArray();

  const facets = await col.aggregate([
    { $match: { "@type": facetType } },
    {
      $facet: {
        hostCountry: [
          { $group: { _id: "$hostCountry", count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        studentType: [
          { $group: { _id: "$studentType", count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        teachingArea: [
          { $group: { _id: "$teachingArea", count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]).toArray();

  const filters = [
    {
      name: 'Country',
      options: facets[0].hostCountry.map(f => ({
        label: f._id || 'N/A',
        value: f._id,
        count: f.count
      }))
    },
    {
      name: 'Student Type',
      options: facets[0].studentType.map(f => ({
        label: f._id || 'N/A',
        value: f._id,
        count: f.count
      }))
    },
    {
      name: 'Teaching Area',
      options: facets[0].teachingArea.map(f => ({
        label: f._id || 'N/A',
        value: f._id,
        count: f.count
      }))
    }
  ];

  res.render('facet', { data, filters });
});

module.exports = router;
