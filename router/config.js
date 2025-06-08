// config.js — universal reusable version for ESL / EDU / other services

// ✅ 환경변수 기반 기본 설정
const _schema = process.env.COLLECTION;
const _subDomain = process.env.SERVICE_NAME;
const _collection = process.env.COLLECTION;

// ✅ 서비스별 기본 타이틀 및 메뉴 구성
const _default_title = 'Job_Vacancies';
const _facet_menu = ['Job_Vacancies', 'Job_Seekers', 'Online_Tutors'];
const _existSubClass = []; // 하위 분류가 있는 경우만 명시

// ✅ URI 마스킹 버전 설정 (MongoDB 키 충돌 방지용)
const _label = 'http://www[dot]w3[dot]org/2000/01/rdf-schema#label';
const _altLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#altLabel';
const _prefLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#prefLabel';
const _hiddenLabel = 'http://www[dot]w3[dot]org/2004/02/skos/core#hiddenLabel';
const _description = 'http://purl[dot]org/dc/elements/1[dot]1/description';
const _subClassOf = 'http://www[dot]w3[dot]org/2000/01/rdf-schema#subClassOf';
const _defaultFacets = 'http://topbraid[dot]org/facet#defaultFacets';
const _class = 'http://www[dot]w3[dot]org/2002/07/owl#Class';
const _resource = `http://${_subDomain}[dot]${_schema}[dot]kr/resource/`;
const _thing = 'http://www[dot]w3[dot]org/2002/07/owl#Thing';
const _lat_long = 'http://www[dot]w3[dot]org/2003/01/geo/wgs84_pos#lat_long';
const _objectProperty = 'http://www[dot]w3[dot]org/2002/07/owl#ObjectProperty';
const _datatypeProperty = 'http://www[dot]w3[dot]org/2002/07/owl#DatatypeProperty';
const _skosConecept = 'http://www[dot]w3[dot]org/2004/02/skos/core#Concept';
const _skosNameIdentifier = 'http://www[dot]w3[dot]org/2004/02/skos/core#NameIdentifier';
const _topic_clip = 'http://sight[dot]eventpool[dot]kr/resource/topic_clip';
const _is_facet_map = 'http://sight[dot]eventpool[dot]kr/resource/displayAsMapOnFacets';

// ✅ 모델 및 모듈 로딩
const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const Structure = require('../model/structure');
const SubClass = require('../model/subClass');

// ✅ 공통 설정 내보내기
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
  skosConecept: _skosConecept,
  skosNameIdentifier: _skosNameIdentifier,
  topic_clip: _topic_clip,
  is_facet_map: _is_facet_map
};

// ✅ 검색 조건 필드 설정
exports.search = {
  in: [
    '@id',
    _label + '.@value',
    _label,
    _altLabel + '.@value',
    _altLabel,
    _prefLabel + '.@value',
    _prefLabel,
    _hiddenLabel + '.@value',
    _hiddenLabel
  ],
  nin: [
    _class,
    _objectProperty,
    _datatypeProperty,
    'http://www[dot]w3[dot]org/1999/02/22-rdf-syntax-ns#Property',
    _skosConecept
  ]
};

// ✅ 구조 초기화 함수
const createStructure = async () => {
  try {
    const tableDisplay = await Schema.findOne({ '@id': _resource + 'TableDisplay' });
    const menuOrder = tableDisplay?.toObject()[_resource + '전체메뉴순서'];
    const default_facet = menuOrder && menuOrder['@list']
      ? menuOrder['@list'].filter(v => !v['@id'].includes('with'))
      : [];

    await Structure.deleteMany({});

    for (const v of default_facet) {
      const arr = await Schema.find({ '@type': v['@id'] });
      let query;

      if (_existSubClass.includes(v['@id'].replace(_resource, ''))) {
        const subClass = await Schema.find({ [_subClassOf + '.@id']: v['@id'] });
        const sub_query = subClass.map(s => ({ '@type': s.toObject()['@id'] }));
        const subDocs = await Schema.aggregate([{ '$match': { '$or': sub_query } }]);

        query = subDocs.map(o => ({
          facet_id: o['@id'],
          _type: v['@id'],
          _subClass: o['@type']
        }));
      } else {
        query = arr.map(w => ({
          facet_id: w.toObject()['@id'],
          _type: w.toObject()['@type'],
          _class: v['@id']
        }));
      }

      await Structure.insertMany(query);
    }
  } catch (e) {
    console.error(e);
  }
};

// ✅ 초기화 자동 실행
exports.resetStructure = createStructure();

// ✅ 구조 정보 반환 함수
exports.getStructure = async () => {
  const class_array = _facet_menu.map(v => ({
    '@type': { $in: [_resource + v] }  // ✅ 정확한 일치에도 대응
  }));
  const subClass_array = _facet_menu.map(v => ({ [_subClassOf + '.@id']: _resource + v }));

  const _class = await Schema.aggregate([
    { $match: { $or: class_array } },
    { $group: { _id: '$@type', list: { $push: '$$ROOT' }, count: { $sum: 1 } } },
    { $unwind: '$_id' },
    { $group: { _id: '$_id', list: { $push: '$$ROOT.list' }, count: { $sum: '$$ROOT.count' } } }
  ]);

  const _subClass = await Schema.aggregate([
    { $match: { $or: subClass_array } },
    {
      $group: {
        _id: _subClassOf + '.@id',
        subClass: { $push: { '@type': '$@id' } }
      }
    }
  ]);

  const sub_obj = {};
  for (const sc of _subClass) {
    sub_obj[sc._id] = await Schema.aggregate([{ $match: { $or: sc.subClass } }]);
  }

  const subClass = _subClass.map(v => ({
    _id: v._id,
    subClass: v.subClass,
    list: sub_obj[v._id],
    count: sub_obj[v._id]?.length || 0
  }));

  _class.forEach(v => {
    v.list = v.list.reduce((a, b) => a.concat(b), []);
  });

  return _class.concat(subClass);
};
