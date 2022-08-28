let mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId

let integrationSchema = mongoose.Schema({
    name: { type: String, required: true },
    function: { type: String, required: true },
    model: { type: mongoose.Schema.Types.Mixed },
})

let Integration = module.exports = mongoose.model('Integration', propertySchema);
