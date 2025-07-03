const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION = 'esl';
const BASE = 'http://esl.eventpool.kr/resource/';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filterQuery = { "@type": { $in: [facetType, `${BASE}${facetType}`] } };
  const filtersParam = req.query.filter;

  if (filtersParam) {
    const filters = Array.isArray(filtersParam) ? filtersParam : [filtersParam];
    filters.forEach(f => {
      const [field, val] = f.split(':');
      filterQuery[field] = val;
    });
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const data = await col.find(filterQuery).toArray();
  const count = data.length;

  const filters = [];
  const countries = await col.distinct('country', filterQuery);
  if (countries.length) {
    filters.push({ field: 'country', values: countries });
  }
  const titles = await col.distinct('rdfs:label.@value', filterQuery);
  if (titles.length) {
    filters.push({ field: 'rdfs:label.@value', values: titles });
  }

  res.render('facet', { data, count, filters });
});

module.exports = router;
