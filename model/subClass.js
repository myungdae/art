const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const _collectionName = process.env.SERVICE_NAME;

/*  Facet 의 전반적인 구조를 담는 스키마. */
const subClassSchema = new Schema({
    _id:String,
    subClass:Object
});
module.exports = mongoose.model(_collectionName + '_subClass', subClassSchema);