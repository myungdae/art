const mongoose = require('mongoose');
mongoose.set('strictQuery', false);
const Schema = mongoose.Schema;
const _resource = process.env.SERVICE_DOMAIN;
const _collectionName = process.env.SERVICE_NAME;
const _defaultFacets = _resource + 'defaultFacets';

/*  Facet 의 전반적인 구조를 담는 스키마. */
const defaultSchema = new Schema({
    //id:mongoose.Schema.Types.ObjectId,
    '@id': String,
    '@type': String,
}, {collection:_collectionName});
module.exports = mongoose.model(_collectionName + '_default', defaultSchema);
