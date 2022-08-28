let mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId

let fileSchema = mongoose.Schema({
    created_at: { type: Date, default: Date.now },
    author: { type: ObjectId, required: true, ref: 'User'},
    
    original_name: String,
    location: String,
    key: String,
    content_type: String,
    size: Number
});

let File = module.exports = mongoose.model('File', fileSchema);

