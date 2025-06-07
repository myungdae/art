const express = require('express');
const router = express.Router();
const Schema = require('../model/default');
const Structure = require('../model/structure');
const config = require('../router/config');

router.get('/:id', async (req, res, next) => {
  const doc = await Schema.findOne({ '@id': config.comm.resource + req.params.id });
  const collections = await Schema.findOne({ '@id': config.comm.resource + 'OrderedCollection' });

  if (!doc || !collections) {
    console.warn('❗ Null document or collection for ID:', req.params.id);
    return res.status(404).render('error', {
      message: '해당 리소스를 찾을 수 없습니다.',
      error: {}
    });
  }

  const displayOnMiddle = collections.toObject()[config.comm.resource + 'displayOnMiddle']?.['@list'] || [];
  const displayOnMiddleQuery = displayOnMiddle.map(v => {
    let obj = {};
    obj[v['@id'] + '.@id'] = config.comm.resource + req.params.id;
    return obj;
  });

  const table_collections = await Schema.aggregate([
    { $match: { $or: displayOnMiddleQuery } },
    { $sort: { '@id': 1 } }
  ]);

  const skos_Concept = await Schema.find({ '@type': config.comm.skosConecept }).lean();
  const skos_Namefilter = await Schema.find({ '@type': config.comm.skosNameIdentifier }).lean();

  const displayOnTop = collections.toObject()[config.comm.resource + 'displayOnTop']?.['@list']?.map(v => v['@id']) || [];

  const displayOnMiddleInfo = await Schema.aggregate([
    { $match: { $or: displayOnMiddle } },
    { $sort: { '@id': 1 } }
  ]);

  const displayOnLabel = {};
  Object.values(displayOnMiddleInfo).forEach(item => {
    if (typeof item === 'object') {
      const labelUri = item['@id']?.replace(config.comm.resource, '');
      const labelWord = item['http://www[dot]w3[dot]org/2000/01/rdf-schema#label'];
      displayOnLabel[labelUri] = labelWord?.['@value'] || labelUri;
    }
  });

  const movieClipObj = doc.toObject();
  const movieClipKeys = Object.keys(movieClipObj);
  const movieClipList = movieClipKeys.filter(key =>
    key.endsWith('_유무형문화재') ||
    key.endsWith('_테마여행') ||
    key.endsWith('_관광명소') ||
    key.endsWith('_유물유적')
  );
  const movieClipResult = movieClipList.map(key => movieClipObj[key]);
  const mergeArr = movieClipResult.reduce((acc, cur) => acc.concat(cur), []);
  const displayOnMovieClip = {};

  if (Array.isArray(mergeArr) && mergeArr.length > 0) {
    const mcResult = await Schema.aggregate([
      { $match: { $or: mergeArr } },
      { $sort: { '@id': 1 } }
    ]);
    mcResult.forEach(entry => {
      const resID = entry['@id'];
      const resTopic_Clip = entry[config.comm.topic_clip]?.['@value'];
      if (resTopic_Clip) displayOnMovieClip[resID] = resTopic_Clip;
    });
  }

  const Labeldata = [];
  displayOnTop.forEach(item => {
    const labelName = item.split('/').pop();
    const labelVal = doc.toObject()[item];
    if (labelVal) {
      if (Array.isArray(labelVal)) {
        labelVal.forEach(v => {
          if (v['@value']) Labeldata.push(`${labelName}  :  ${v['@value']}`);
        });
      } else if (labelVal['@value']) {
        Labeldata.push(`${labelName}  :  ${labelVal['@value']}`);
      }
    }
  });

  let parentClass;
  const check_subClass = await Schema.aggregate([
    {
      $match: {
        $and: [
          { '@id': doc.toObject()['@type'] },
          { 'http://topbraid[dot]org/facet#defaultFacets': { $exists: true } }
        ]
      }
    }
  ]);

  if (!check_subClass[0]) {
    const parent = await Schema.aggregate([
      { $match: { '@id': doc.toObject()['@type'] } }
    ]);
    // future enhancement: resolve subClassOf
  } else {
    parentClass = check_subClass[0]['@id'];
  }

  res.render('detail', {
    doc: doc.toObject(),
    collections: collections.toObject(),
    skos_Concept,
    skos_Namefilter,
    table_collections,
    parentClass,
    searchKeyword: req.params.id,
    displayOnMovieClip,
    Labeldata,
    displayOnLabel
  });
});

module.exports = router;
