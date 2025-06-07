const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const config = require('../router/config');
const Structure = require('../model/structure');
/* GET home page. */
router.all('/:id/:sub?', async (req, res, next) => {
  let list = [];
  try {


    const facet_id = req.params.id;
    const sub_facet_id = req.params.sub;
    let filter_item = [], filter_query = [], final_query = [];
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    if (req.method === 'POST') {
      let obj = {}, or_obj = {};
      /*  POST 로 값이 넘어왔을 경우
      *   filter 를 적용했을 때만 POST 로 넘어 옴.
      *   filtering 된 부분의 query 를 만들어준다. */

      // console.log('req.body : ' + JSON.stringify(req.body, null, '\t'));

      req.body['item'].split(',').forEach((v) => {
        let facet = v.split('::')[0];
        let title = v.split('::')[1];
        let attr = v.split('::')[2];

        // console.log('title : ' + title);
        // console.log('req.param.id : ' + req.params.id);

        let original = req.params.id + '_' + title;
        // let original = req.params.id + title;        
        let reverse = title + '_' + req.params.id;
        // let reverse = title + req.params.id;

      
        filter_query = [];
        obj = {};
        obj[config.comm.resource + original + '.@id'] = config.comm.resource + attr;
        filter_query.push(obj);
        obj = {};
        obj[config.comm.resource + reverse + '.@id'] = config.comm.resource + attr;
        filter_query.push(obj);
        filter_query.push({'@id': config.comm.resource + attr});

        or_obj = {};
        or_obj['$or'] = filter_query;


        // console.log('or_obj : ' + JSON.stringify(or_obj, null, '\t'));


        final_query.push(or_obj);

        filter_item.push(v);
      });
    }

    if (final_query.length === 0) final_query.push({});
    

    //  1. default_facet 추출
    //  1-1. subClass 인지 먼저 확인한다.
    let subClass = await Structure.findOne({_subClass: config.comm.resource + sub_facet_id});
    let schema;
    /*
    하위 메뉴 여부에 따라 정보 리턴
    */
    if (subClass) {
      schema = await Schema.findOne({'@id': config.comm.resource + subClass._type[0].replace(config.comm.resource, '')});
    } else {
      schema = await Schema.findOne({'@id': config.comm.resource + facet_id});
    }


	  // console.log('facet id :    ' + facet_id);
		// console.log('sub facet id :    ' + sub_facet_id);
		// console.log('facet data result :    ' + schema);
    // console.log('##############################################');
    // console.log('defaultFacets : ' + config.comm.defaultFacets);
    // console.log('subClass : ' + subClass);
    // console.log('schema : ' + JSON.stringify(schema, null, '\t'));

    if (schema.toObject()[config.comm.defaultFacets]) { // default facet 이 설정되어 있어야 다음으로 넘어감

      let default_facet = schema.toObject()[config.comm.defaultFacets]['@list'].map((v) => {
        return v['@id'].replace(config.comm.resource, '')
      });


      // console.log('default_facet : ' + JSON.stringify(default_facet, null, '\t'));



      let query_list = [];

      let facetId = 0;
      //  2. default facet 에서 inverse 관계를 만들어준다.
      default_facet.forEach((v) => {
        query_list.push([v, facetId++]);
        //let item = v.split('_');
        //query_list.push(item[1] + '_' + item[0]);
      });
      // console.log(query_list);


      // console.log('##############################################');
      // console.log('query_list : ' + query_list);
      // console.log('subClass : ' + subClass);

      // 3. body 를 뽑는 새로운 방법
      let subClass_query = {}, sub_facet_query = {};
      if(sub_facet_id) sub_facet_query['@type'] = config.comm.resource+ sub_facet_id;
      subClass_query[config.comm.subClassOf + '.@id'] = config.comm.resource + facet_id;
      let subClass = await Schema.aggregate([
        {
          $match: {
            $or: [
              {'@id': config.comm.resource + facet_id},
              subClass_query
            ]
          }
        },
        {$group: {_id: '$@id'}}
      ]);



      let query = subClass.map((v) => {
        let obj = {};
        obj['@type'] = v._id;
        return obj;
      });


      // console.log('query : ' + JSON.stringify(query, null, '\t'));

      // console.log("========================================================");
      // console.log('final_query : ' + JSON.stringify(final_query, null, '\t'));
      // console.log('query : ' + JSON.stringify(query, null, '\t'));
      // console.log('sub_facet_query : ' + JSON.stringify(sub_facet_query, null, '\t'));
      // console.log("========================================================");

      let body = await Schema.aggregate([
        {$match: {$and: final_query}},
        {$match: {$or: query}},
        {$match:sub_facet_query},
        {$unwind: '$@type'},
        {$group: {_id: '$@type', count: {$sum: 1}, list: {$push: '$$ROOT'}}},
      ]);

      // console.log('body : ' + JSON.stringify(body, null, '\t'));
      

      //  3. default facet query 문 만들기
      let or_query = query_list.map((vv) => {
        let v = vv[0];
        let obj = {};
        obj[config.comm.resource + v] = {'$exists': true};
        return obj
      });


      // console.log('or_query : ' + JSON.stringify(or_query, null, '\t'));

      //  4. body 중에서 left를 뽑아낸다.
      // let body_match = {$match: {$or: [{'@type': config.comm.resource + facet_id}]}};
      // //  4-1. subClass 가 있는지 확인하고 있으면 query 를 만들어 준다.
      // let subClass_list = await Structure.aggregate([
      //   {$match: {_type: config.comm.resource + facet_id}},
      //   // {
      //   //   $expr: {}
      //   // },
      //   // _subClass: {$exists: true}}
      // ]);
      // console.log('subClass_list : ', subClass_list);
      // if (subClass_list.length > 0) {
      //   let list = subClass_list.map((v) => {
      //     return {'@type': v._subClass}
      //   });
      //   body_match.$match.$or = body_match.$match.$or.concat(list);
      // }
      // let body = await Schema.aggregate([
      //   body_match,
      //   {$match: {$and: final_query}},
      //   {
      //     $group: {
      //       '_id': '$@type',
      //       sum: {$sum: 1},
      //       list: {$push: '$$ROOT'}
      //     }
      //   },
      //   {$unwind: '$_id'},
      //   {
      //     $group:
      //       {
      //         '_id': '$_id',
      //         sum: {$sum: '$$ROOT.sum'},
      //         list: {$push: '$$ROOT.list'}
      //       }
      //   },
      //   {$sort: {'_id': 1}}
      // ]);

      let new_body;
      let cnt = 0;
      let size = query_list.length;

      // console.log('facet_id : ' + facet_id);
      // console.log('default_title : ' + config.comm.default_title);



      if (config.comm.default_title === facet_id) {
        /*  기본 패싯일 때 즉, default_title 의 패싯을 검색할 때
        *   1. @type 으로 1차 필터링
        *   2. 필터링 된 list 에 type, inverse 관계가 있을 경우 해당 key 의 @id 값을 기준으로 grouping
        *   3. grouping 되지 않은 리스트 제외
        *   4. parentType 추가
        * */


        // console.log('================================================');
        // console.log('@type : ' + config.comm.resource + facet_id);
        // console.log('-----------------------------------------------');
        // console.log('or_qyery : ' + JSON.stringify(or_query, null, '\t'));
        // console.log('-----------------------------------------------');
        // console.log('final_query : ' + JSON.stringify(final_query));
        // console.log('================================================');

        query_list.forEach(async (vv) => {
          let v = vv[0];
          let facetId = vv[1];
          let schema = [
            { $match: { $or: [{ '@type': config.comm.resource + facet_id }].concat(or_query) } },
            { $match: { $and: final_query } },
            {$match: sub_facet_query},
            {
              $group: {
                '_id': '$' + config.comm.resource + v + '.@id',
                sum: { $sum: 1 },
                type: { $first: '$$ROOT.@type' },
                attr: { $first: '$$ROOT.' + config.comm.resource + v + '.@id' }
              }
            },
            { $unwind: '$_id' },
            {
              $group: {
                '_id': '$_id',
                sum: { $sum: '$$ROOT.sum' },
                type: { $first: '$$ROOT.type' },
                attr: { $first: '$$ROOT.attr' }
              }
            },
            { $match: { _id: { '$ne': null } } },
            { $addFields: { 'parentType': v, 'facetId': facetId } },
            { $sort : { _id : 1 } }
          ];
          new_body = await Schema.aggregate(schema);

          if (new_body[0])
            list.push(new_body);
          if (++cnt === size) {
            fnCallback(list);
          }



          // console.log('v : ' + v );
          // // console.log('@id : ' + config.comm.resource + facet_id );
          // console.log('final_query : ' + JSON.stringify(final_query) );
          // console.log('or_query : ' +  JSON.stringify(or_query));
          // // console.log('sub_match : ' + JSON.stringify(sub_match));
          // console.log('new_body : ' + new_body);
        });
      } else {
        /*  기본 패싯을 제외한 나머지 패싯의 경우
        *   1. sub_match( facet, inverse 관계를 key 로 가지고 있는지 유무 ) 으로 1차 필터링
        *   2. 필터링 된 list 중
        *       2.1 facet 을 type 으로 갖는 데이터의 경우 : 해당 key 의 @id 값으로 grouping
        *       2.2 그 외 : @id 값으로 grouping
        *   3. grouping 되지 않은 리스트 제외
        *   4. parentType 추가
        * */
        query_list.forEach(async (vv) => {
          let v = vv[0];
          let facetId = vv[1];
          let sub_match = {};
          sub_match[config.comm.resource + v] = { '$exists': true };


          // console.log('sub_match : ' + JSON.stringify(sub_match, null, '\t'));
          // console.log('facet_id : ' + facet_id);
          // console.log('final_query : ' + JSON.stringify(final_query, null, '\t'));
          let schema = [
            { $match: { $or: [{ '@type': config.comm.resource + facet_id }].concat(or_query) } },
            { $match: { $and: final_query } },
            {$match: sub_facet_query},
            {
              $group: {
                '_id': '$' + config.comm.resource + v + '.@id',
                sum: { $sum: 1 },
                type: { $first: '$$ROOT.@type' },
                attr: { $first: '$$ROOT.' + config.comm.resource + v + '.@id' }
              }
            },
            { $unwind: '$_id' },
            {
              $group: {
                '_id': '$_id',
                sum: { $sum: '$$ROOT.sum' },
                type: { $first: '$$ROOT.type' },
                attr: { $first: '$$ROOT.attr' }
              }
            },
            { $match: { _id: { '$ne': null } } },
            { $addFields: { 'parentType': v, 'facetId': facetId } },
            { $sort : { _id : 1 } }
          ]
          new_body = await Schema.aggregate(schema);



          // console.log('new_body : ' + JSON.stringify(new_body, null, '\t'));



          if (new_body[0])
            list.push(new_body);
          if (++cnt === size)
            fnCallback(list);



          // console.log('@id : ' + config.comm.resource + facet_id )
          // console.log('list : ' + JSON.stringify(list));
          // console.log('sub_match : ' + JSON.stringify(sub_match));
        });
      }
      const fnCallback = (list) => {
        // type(facet title -> parentType) 을 가나다 순으로 정렬
        list.sort((a, b) => {
          return (a[0]['facetId'] - b[0]['facetId'])
        });
        
        let schemaObj = schema.toObject();
        let displayAsMap = schemaObj[config.comm.is_facet_map] ? (schemaObj[config.comm.is_facet_map]["@value"] == "true") : false;
        let displayReallyAsMap = displayAsMap && req.query && !req.query.text;
        res.render(displayReallyAsMap ? 'facet_map' : 'facet', {
          title: req.params.id,
          body: body,
          list: list,
          filter_item: filter_item,
          allow_map: displayAsMap
        });
      };
    } else {
      res.send('<script type="text/javascript">alert("자료가 없습니다."); history.back();</script>');
    }
  } catch (e) {
    res.status(404);
  }
});

// 다시 만드는 것
router.get('/ttt/:id/:sub?', async (req, res) => {
  let facet = req.params.id;    // 기본 패싯
  let sub = req.params.sub;     // sub class 가 있을 경우 패싯 TODO
  let subClass_query = {}, sub_facet_query = {};
  subClass_query[config.comm.subClassOf + '.@id'] = config.comm.resource + facet;
  let subClass = await Schema.aggregate([
    {
      $match: {
        $or: [
          {'@id': config.comm.resource + facet},
          subClass_query
        ]
      }
    },
    {$group: {_id: '$@id'}}
  ]);
  let query = subClass.map((v) => {
    let obj = {};
    obj['@type'] = v._id;
    return obj;
  });
  if(sub) sub_facet_query['@type'] = config.comm.resource+ sub;
  let body = await Schema.aggregate([
    {$match: {$or: query}},
    {$match:sub_facet_query},
    {$unwind: '$@type'},
    {$group: {_id: '$@type', count: {$sum: 1}, list: {$push: '$$ROOT'}}},
  ]);
  let list = [];
  let filter_item = [];





  // console.log("list : " + JSON.stringify(list));



  const currentUrl = req.originalUrl;
  // console.log('currentUrl : ' + currentUrl);

  res.render('facet', {
    title: req.params.id,
    body: body,
    list: list,
    filter_item: filter_item,
    currentUrl:currentUrl
  });
});
module.exports = router;


// /*
// 패싯 리스트 정보 리턴 함수
// */
// async function facetList(Schema, facet_id = _defaultFacets) {

//   let facet_uri = _resource + facet_id; // 선택 메뉴
//   let arr = await Schema.find({'@type': facet_uri}), query; // 리스트 정보 리턴

//    // 하위 메뉴 (subClass)가 있는 경우
//    if (_existSubClass.indexOf(facet_uri.replace(_resource, '')) > -1) {
    
//     let obj = {};
//     obj[_subClassOf + '.@id'] = facet_uri;
//     let subClass = await Schema.find(obj);
//     let sub_query = subClass.map((s) => {
//       return {'@type': s.toObject()['@id']}
//     });
//     let subDocs = await Schema.aggregate([{'$match': {'$or': sub_query}}]);

//     query = subDocs.map((o) => {

//       if(o.toObject()[_label]) {
//         let _label = "o.toObject()[_label]['@value']";
//       } else {
//         let _label = "";
//       }
//       return {
//         'facet_id': o['@id'],
//         '_type': facet_uri,
//         '_subClass': o['@type'],
//         '_label': _label
//       }
//     });
// // 하위 메뉴 (subClass)가 없는 경우
//   } else {

//     query = arr.map((w) => {

//       if(w.toObject()[_label]) {
//         let _label = "w.toObject()[_label]['@value']";
//       } else {
//         let _label = "";
//       }
//       return {
//           'facet_id': w.toObject()['@id'],
//           '_type': w.toObject()['@type'],
//           '_class': facet_uri,
//           '_label': _label
//       }
//     });
//   }
  
//   return query;
// }