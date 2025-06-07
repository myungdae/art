// 신규 인스턴스 설정시 변경해야 할 부분
const _schema = process.env.COLLECTION;
const _subDomain = process.env.SERVICE_NAME;
const _collection = process.env.COLLECTION;

// console.log('_schema : ' + _schema);
// console.log('_subDomain : ' + _subDomain);
// console.log('_collection : ' + _collection);


const _default_title = '작품';
const _facet_menu = ['작품', '작가', '이벤트', '매체', '주제', '대상'];
 // 최상위 메뉴
const _existSubClass = []; // 하위메뉴가 있는경우 

const _label = 'http://www[dot]w3[dot]org/2000/01/rdf-schema#label';
const _altLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#altLabel';
const _prefLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#prefLabel';
const _hiddenLabel = 'http://www.w3.org/2004/02/skos/core#hiddenLabel';
const _description = 'http://purl[dot]org/dc/elements/1[dot]]1/description';
const _subClassOf = 'http://www[dot]w3[dot]org/2000/01/rdf-schema#subClassOf';
const _defaultFacets = 'http://topbraid[dot]org/facet#defaultFacets';
const _class = 'http://www[dot]w3[dot]org/2002/07/owl#Class';
const _resource = 'http://' + _subDomain + '[dot]' + _schema + '[dot]kr/resource/';
const _thing = 'http://www[dot]w3[dot]org/2002/07/owl#Thing';
const _lat_long = 'http://www[dot]w3[dot]org/2003/01/geo/wgs84_pos#lat_long';
const _objectProperty = 'http://www[dot]w3[dot]org/2002/07/owl#ObjectProperty';
const _datatypeProperty = 'http://www[dot]w3[dot]org/2002/07/owl#DatatypeProperty';
const _skosConecept = 'http://www[dot]w3[dot]org/2004/02/skos/core#Concept';
const _skosNameIdentifier = 'http://www[dot]w3[dot]org/2004/02/skos/core#NameIdentifier';
const _topic_clip = 'http://sight[dot]eventpool[dot]kr/resource/topic_clip';
const _is_facet_map = 'http://sight[dot]eventpool[dot]kr/resource/displayAsMapOnFacets';
const { query } = require('express');
const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const Structure = require('../model/structure');
const SubClass = require('../model/subClass');
exports.comm = {
  label: _label,
  altLabel: _altLabel,
  prefLabel: _prefLabel,
  hiddenLabel: _hiddenLabel,
  description: _description,
  subClassOf: _subClassOf,
  defaultFacets: _defaultFacets,
  class: _class,
  resource: _resource,
  thing: _thing,
  lat_long: _lat_long,
  objectProperty: _objectProperty,
  datatypeProperty: _datatypeProperty,
  default_title: _default_title,
  facet_menu: _facet_menu,
  schema: _schema,
  collection: _collection,
  skosConecept : _skosConecept,
  skosNameIdentifier : _skosNameIdentifier,
  topic_clip : _topic_clip, //영상 클립
  is_facet_map : _is_facet_map
}; 
exports.search = {
  in: ['@id', 'http://www[dot]w3[dot]org/2000/01/rdf-schema#label.@value'
    , 'http://www[dot]w3[dot]org/2000/01/rdf-schema#label'
    , 'http://www[dot]w3[dot]org/2004/02/skos/core#altLabel.@value'
    , 'http://www[dot]w3[dot]org/2004/02/skos/core#altLabel'
    , 'http://www[dot]w3[dot]org/2004/02/skos/core#prefLabel.@value'
    , 'http://www[dot]w3[dot]org/2004/02/skos/core#prefLabel'
    , 'http://www.w3.org/2004/02/skos/core#hiddenLabel.@value'
    , 'http://www.w3.org/2004/02/skos/core#hiddenLabel'
  ],
  nin: [
    'http://www[dot]w3[dot]org/2002/07/owl#Class',
    'http://www[dot]w3[dot]org/2002/07/owl#ObjectProperty',
    'http://www[dot]w3[dot]org/2002/07/owl#DatatypeProperty',
    'http://www[dot]w3[dot]org/1999/02/22-rdf-syntax-ns#Property',
    'http://www[dot]w3[dot]org/2004/02/skos/core#Concept'
  ]
};






createStructure = async () => {
  try {

    /* 기본 서비스 구조 정보 리턴 ********************************************************/

    let tableDisplay = await Schema.findOne({'@id': _resource + 'TableDisplay'});


    // console.log('tableDisplay : ' + JSON.stringify(tableDisplay, null, 5));


    // // 최상위 메뉴정보만 리턴
    // let default_facet = tableDisplay.toObject()[_resource + 'displayOnTable']['@list'].filter((v) => {
    //   if (v['@id'].indexOf('with') === -1) return v
    // });
    // 최상위 메뉴정보만 리턴
    let default_facet = tableDisplay.toObject()[_resource + '전체메뉴순서']['@list'].filter((v) => {
      if (v['@id'].indexOf('with') === -1) return v
    });

    /******************************************************** 기본 서비스 구조 정보 리턴 */
    // console.log('@id :  ' + _resource + 'TableDisplay');
    // console.log('tableDisplay :  ' + JSON.stringify(tableDisplay));
    // console.log('tableDisplay :  ' + tableDisplay);
    // console.log('tableDisplay : ' + JSON.stringify(tableDisplay, null, '\t'));
    // console.log('default_facet : ' + JSON.stringify(default_facet, null, '\t'));
    // console.log('skosConcept : ' + JSON.stringify(skosConcept, null, '\t'));

    // Structure 스키마 내용 삭제
    await Structure.deleteMany({});






    // console.log()







    /* 최상위 메뉴에서 상세 정보 리턴 - displayOnTable */
    default_facet.forEach(async (v) => {
      
      let arr = await Schema.find({'@type': v['@id']}), query;

      // console.log('default_facet : ' + JSON.stringify(default_facet, null, 2));
      // console.log('v : ' + JSON.stringify(v, null, 2));
    

      // if (arr.length === 0) {
      // let query;

      // 하위 메뉴 (subClass)가 있는 경우
      if (_existSubClass.indexOf(v['@id'].replace(_resource, '')) > -1) {
        let obj = {};
        obj[_subClassOf + '.@id'] = v['@id'];
        let subClass = await Schema.find(obj);
        let sub_query = subClass.map((s) => {
          return {'@type': s.toObject()['@id']}
        });
        let subDocs = await Schema.aggregate([{'$match': {'$or': sub_query}}]);
        query = subDocs.map((o) => {
          return {
            'facet_id': o['@id'],
            '_type': v['@id'],
            '_subClass': o['@type'],
            //'_label': o[_label]['@value']
          }
        });
      
      // 하위 메뉴 (subClass)가 없는 경우
      } else {


        query = await arr.map((w) => {
          return {
            'facet_id': w.toObject()['@id'],
            '_type': w.toObject()['@type'],
            '_class': v['@id'],
            //'_label': w.toObject()[_label]['@value']
          }
        });
      }

      // if(v['@id'].replace(_resource, '') == _default_title) {
      //   console.log('arr START ==========================================');
      //   console.log('arr :  ' + JSON.stringify(arr, null, 2));
      //   console.log('arr ============================================ END');
      // }

      // Structure 스키마 만들기
      await Structure.insertMany(query);


    });
  } catch (e) {
    console.error(e);
  }
};


// createStructure();
exports.resetStructure = createStructure();

/*  스키마의 구조를 만들어주는 함수. await config.getStructure() 로 불러올 수 있다. */
exports.getStructure = async () => {
  let class_array = [];
  let subClass_array = [];
  _facet_menu.forEach((v) => {
    class_array.push({'@type': _resource + v});
    subClass_array.push({'http://www[dot]w3[dot]org/2000/01/rdf-schema#subClassOf.@id': _resource + v});
  });

  // console.log('_facet_menu : ' + _facet_menu);


  let _class = await Schema.aggregate([
    {$match: {$or: class_array}},
    {$group: {_id: '$@type', list: {$push: '$$ROOT'}, count: {$sum: 1}}},
    {$unwind: '$_id'},
    {$group: {_id: '$_id', list: {$push: '$$ROOT.list'}, count: {$sum: '$$ROOT.count'}}}
  ]);
  
  
  // console.log('class : ', JSON.stringify(_class, null, 2));
    
  let _subClass = await Schema.aggregate([
    {$match: {$or: subClass_array}},
    {
      $group: {
        _id: '$http://www[dot]w3[dot]org/2000/01/rdf-schema#subClassOf.@id',
        subClass: {$push: {'@type': '$@id'}}
      }
    }
  ]);

  // console.log('sub class : ', JSON.stringify(_subClass, null, 2));

  // console.log('sub class : ', _subClass);
  let sub_len = _subClass.length, sub_idx = 0;
  let sub_obj = {};
  if (sub_len > 0) {
    /*  비동기를 순차적으로 실행할 떄는 forEach 대신 for loop 를 사용해야 한다. */
    for (let i = 0; i < sub_len; i++) {
      sub_obj = {};
      sub_obj[_subClass[i]._id] = await Schema.aggregate([
        {$match: {$or: _subClass[i].subClass}}
      ]);
    }
    // console.log('sub obj : ', sub_obj);
    let subClass = _subClass.map((v) => {
      return {
        _id: v._id,
        subClass: v.subClass,
        list: sub_obj[v._id],
        // count: sub_obj[v._id].length
        count: sub_obj.length
      }
    });
    // _id 를 unwind 했으므로 최종적으로 합쳐준다.
    _class.forEach((v) => {
      v.list = v.list.reduce((a, b) => {
        return a.concat(b)
      }, []);
    });
    let result = _class.concat(subClass);



    // console.log('result : ', JSON.stringify(result, null, 2));



    return _class.concat(subClass);
  } else {
    return _class;
  }
};
