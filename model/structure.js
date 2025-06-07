const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const _collectionName = process.env.SERVICE_NAME;

// console.log('collect : ' + _collectionName + '_Structure');

// 부서 스키마
const structureSchema = new Schema({
    id:mongoose.Schema.Types.ObjectId,
    facet_id:String,
    _type:Array,
    _subClass:Array,
    _label:String
});
module.exports = mongoose.model(_collectionName + '_Structure', structureSchema);