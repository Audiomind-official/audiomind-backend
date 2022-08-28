let mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId

let historySchema = mongoose.Schema({
    created_at: { type: Date, default: Date.now },
    propertyId: { type: ObjectId, required: true },
    interval: {
        started_at: { type: Date },
        updated_at: { type: Date },
        hits: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 0 },
        },
        seconds_transcripted: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 0 },
        },
        entries_analysed: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 0 },
        },
        entries: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 0 },
        },
    },

});


let History = module.exports = mongoose.model('History', historySchema);
