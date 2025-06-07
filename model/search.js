const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const _collectionName = process.env.SERVICE_NAME;

// 검색어를 저장하는 스키마
const searchSchema = new Schema({
    searchText:String,                      // 검색어
    date:{type:Date, default:Date.now}    // 검색일(실제로는 YYYY-MM-DD 형식의 String 으로 저장됨)
});
module.exports = mongoose.model(_collectionName + '_search', searchSchema);