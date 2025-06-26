const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';

const LABEL = 'rdfs:label';
const DESCRIPTION = 'http://purl.org/dc/elements/1.1/description';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filter = req.query.filter;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  let filterQuery = {};
  let filter_item = [];

  if (filter) {
    const filters = Array.isArray(filter) ? filter : [filter];
    filters.forEach(f => {
      const [key, val] = f.split(':');
      if (!filterQuery[key]) filterQuery[key] = { $in: [] };
      filterQuery[key].$in.push(val);
      filter_item.push({ key, val });
    });
  }

  const data = await col.find(filterQuery).limit(100).toArray();

  // ✅ 필터 필드가 존재하지 않아도 작동하도록 보호
  const facetFields = ['country', 'studentType', 'teachingArea'];
  const filtersData = [];

  for (let field of facetFields) {
    try {
      const agg = await col.aggregate([
        { $match: {} },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();

      const values = agg
        .filter(entry => typeof entry._id === 'string' && entry._id.trim())
        .map(entry => ({
          value: entry._id,
          label: entry._id,
          count: entry.count
        }));

      if (values.length > 0) {
        filtersData.push({
          key: field,
          title: field.toUpperCase(),
          values
        });
      }
    } catch (err) {
      console.error(`Error processing facet field ${field}:`, err.message);
    }
  }

  res.render('facet', {
    data,
    filters: filtersData,
    filter_item
  });
});

module.exports = router;
