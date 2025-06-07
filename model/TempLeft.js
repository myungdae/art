const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// default facet schema
const TempLeftSchema = new Schema({
    id:mongoose.Schema.Types.ObjectId,
    facet_id:String
});
module.exports = mongoose.model('TempLeft', TempLeftSchema);