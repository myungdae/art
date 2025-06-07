const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// default facet schema
const tempSchema = new Schema({});
module.exports = mongoose.model('Temp', tempSchema);