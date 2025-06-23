// 📁 ~/esl/model/esl.js
const mongoose = require('mongoose');
const schema = new mongoose.Schema({}, { strict: false });

// ✅ 컬렉션명을 'eventpool'로 고정
module.exports = mongoose.model('Esl', schema, 'eventpool');
