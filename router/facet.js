const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'eventpool';
const COLLECTION_NAME = process.env.COLLECTION || 'esl';

const LABEL = 'rdfs:label';
const DESCRIPTION = 'http://purl.org/dc/elements/1.1/description';
const TYPE = '@type';
const ID = '@id';

router.get('/:type', async (req, res) => {
  const facetType = req.params.type;
  const filter = req.query.filter;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  // ✅ 필터 파싱
  let filterQuery = {};
  let filter_item = [];

  if (filter) {
    const filters = Array.isArray(filter) ? filter : [filter];
    filters.forEach(f => {
      const [title, value] = f.split(':');
      if (!filterQuery[title]) filterQuery[title] = { $in: [] };
      filterQuery[title].$in.push(value);
      filter_item.push({
        title,
        value,
        encoded: encodeURIComponent(`${title}:${value}`)
      });
    });
  }

  // ✅ 문서 불러오기
  const rawDocs = await col.find({
    [TYPE]: { $regex: facetType, $options: 'i' },
    ...filterQuery
  }).toArray();

  const docs = rawDocs.map(doc => {
    const label = doc['http://www.w3.org/2000/01/rdf-schema#label']?.['@value'] ||
                  doc['rdfs:label']?.['@value'] ||
                  doc.title || 
                  doc.label || 
                  'No Title';

    const description = doc[DESCRIPTION]?.['@value'] ||
                        doc.description || 
                        'No description.';

    return {
      _id: doc[ID],
      _type: doc[TYPE],
      _label: label,
      _description: description
    };
  });

  // ✅ 필터 목록 집계
  const facetList = [];
  const facetFields = ['country', 'studentType', 'teachingArea'];

  for (const field of facetFields) {
    const pipeline = [
      { $match: { [TYPE]: { $regex: facetType, $options: 'i' } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const values = await col.aggregate(pipeline).toArray();
    facetList.push({
      _id: field,
      values: values.map(v => ({ val: v._id, count: v.count }))
    });
  }

  res.render('facet', {
    facetType,
    docs,
    facetList,
    filter_item
  });
});

module.exports = router;
