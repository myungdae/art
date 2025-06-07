const express = require('express');
const createError = require('http-errors');
const router = express.Router();
const Schema = require('../model/default');
const Structure = require('../model/structure');
const config = require('../router/config');
const fs = require('fs')

/* GET home page. */
async function renderHome (req, res, next) {
  let structure = await Structure.aggregate([
    {$unwind:'$_type'},
    {$group: {_id: '$_type', count: {$sum: 1}}},
    {$sort: {_id: 1}}
  ]);




  const main_item = [
    {'itemName' : '사료명' , 'sortNo' : 1},
    {'itemName' : '사건' , 'sortNo' : 2},
    {'itemName' : '생산자' , 'sortNo' : 3},
    {'itemName' : '단체기관' , 'sortNo' : 4},
    {'itemName' : '등록기관' , 'sortNo' : 5},
    {'itemName' : '년도' , 'sortNo' : 6},
    {'itemName' : '주제명,' , 'sortNo' : 7},
    {'itemName' : '장르명,' , 'sortNo' : 8},
  ];

  const structureFilter = [];
 
  for(i=0; i < structure.length; i++) {
 
    const _id = structure[i]['_id'].replace(config.comm.resource, '');
    const _count = structure[i]['count'];
 
    main_item.forEach(itemSort => {
 
      if(itemSort.itemName == _id) {
 
        structureFilter.push({'sortNo' : itemSort.sortNo, '_id' : _id, 'count' : _count});
      }
    });
  }
  /*
  JSON 
  */
  structureFilter.sort((a, b) => {
    if(a.sortNo < b.sortNo) return -1;
    if(a.sortNo > b.sortNo) return 1;
  });
 
  let page = "index";
  if (req.params && req.params.id) {
    if (req.params.id == "pages") {
      if (!req.params.sub || req.params.sub.indexOf('/') > -1 || req.params.sub.indexOf('\\') > -1 || !fs.existsSync("./pages/" + req.params.sub + ".pug")) {
        next(createError(404));
        return;
      }
    } else {
      next();
      return;
    }
    page = req.params.sub;
  }
  res.render('index', {
    page: page,
    structure: structureFilter
  });
}
router.get('', renderHome);
router.get('/:id/:sub?', renderHome);
module.exports = router;