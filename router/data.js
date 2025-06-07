const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const config = require('../router/config');
const Structure = require('../model/structure');
const MongoClient = require('mongodb').MongoClient;

// data 등록 화면
router.get('/create', async (req, res, next) => {
  let collections = await Schema.findOne({'@id': config.comm.resource + 'OrderedCollection'});
  let structures = await Structure.aggregate([
    {$unwind: '$_type'},
    {
      $group: {
        _id: '$_type',
        count: {$sum: 1},
        list: {$push: '$$ROOT'}
      }
    }
  ]);
  let class_array = [];
  let subClass_array = [];
  config.comm.facet_menu.forEach((v) => {
    class_array.push({'@type': config.comm.resource + v});
    subClass_array.push({'http://www[dot]w3[dot]org/2000/01/rdf-schema#subClassOf.@id': config.comm.resource + v})
  });
  let structure = await config.getStructure();


  //console.log('structure : ' + JSON.stringify(structure, null, 2));

  res.render('data', {
    title: '신규등록',
    collections: collections.toObject(),
    structures: structures,
    doc: null,
    structure: structure
  });
});



// 데이터 읽기
router.get('/read/:id', async (req, res) => {
  let collections = await Schema.findOne({'@id': config.comm.resource + 'OrderedCollection'});
  let structures = await Structure.aggregate([
    {$unwind: '$_type'},
    {$group: {_id: '$_type', count: {$sum: 1}, list: {$push: '$$ROOT'}}}
  ]);
  let doc = await Schema.findOne({'@id': config.comm.resource + req.params.id});
  let structure = await config.getStructure();
  res.render('data', {
    title: '읽기',
    doc: doc.toObject(),
    collections: collections.toObject(),
    structures: structures,
    structure: structure
  });
});
// 데이터 신규등록
router.post('/create/:id', async (req, res) => {
  let query = JSON.parse(req.body.query);
  let check_id = await Schema.findOne({'@id': config.comm.resource + req.params.id});
  
  
  
  // console.log('check_id : ' + check_id);
  // console.log('query : ' + JSON.stringify(query, null, 2));


  
  if (!check_id) {
    MongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true}, async (err, db) => {
      if (err) throw err;
      let dbo = db.db(config.comm.schema);
      let result = await dbo.collection(config.comm.collection).insertOne(query);
      res.json({result: 1, message: '등록성공', data: result});
    });
  } else {
    res.json({result: 0, message: '이미 등록되어 있는 ID 값입니다.'})
  }
});
router.put('/update/:id', async (req, res) => {
  let query = JSON.parse(req.body.query);
  await Schema.deleteOne({'@id': config.comm.resource + req.params.id});
  MongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true}, async (err, db) => {
    if (err) throw err;
    let dbo = db.db(config.comm.schema);
    let result = await dbo.collection(config.comm.collection).insertOne(query);
    res.json({result: 1, message: '수정성공', data: result});
  });
});
router.get('/checkDelete/:id', async (req, res) => {
  let doc = await Schema.aggregate([
    {$match: {'@id': config.comm.resource + 'OrderedCollection'}}
  ]);
  let middle = doc[0][config.comm.resource + 'displayOnMiddle']['@list'].map((v) => {
    let obj = {};
    obj[v['@id'] + '.@id'] = config.comm.resource + req.params.id;
    return obj;
  });
  let result = await Schema.aggregate([
    {$match: {$or: middle}},
    {$group: {_id: '', count: {$sum: 1}, list: {$push: '$$ROOT'}}}
  ]);
  res.json(result);
});
router.delete('/:id', async (req, res) => {
  let result = await Schema.deleteOne({'@id': config.comm.resource + req.params.id});
  res.json(result);
});
// subClass 읽기
router.get('/subClass/:id', async (req, res) => {
  let subClassList = await Schema.find({'@type': config.comm.resource + req.params.id});
  res.json(subClassList);
});
router.post('/subClass', async (req, res) => {
  let query = JSON.parse(req.body.list);
  MongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true}, async (err, db) => {
    if (err) throw err;
    let dbo = db.db(config.comm.schema);
    let result = await dbo.collection(config.comm.collection).insertMany(query);
    res.json({result: 1, message: '등록성공', data: result});
  });
});

router.get('/subMenu/:id', async (req, res) => {
  const facet_id = req.params.id;

  let subClass_query = {
    [config.comm.subClassOf + '.@id']: config.comm.resource + facet_id
  }
  
  let subClass = await Schema.aggregate([
          {
            $match: {
              $or: [
                subClass_query
              ]
            }
          },
          {$group: {_id: '$@id'}}
        ]);
  res.json(subClass);
});
module.exports = router;
