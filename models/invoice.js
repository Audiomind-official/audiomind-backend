let mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId

let invoiceSchema = mongoose.Schema({
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    id: { type: Number, required: true }, 
    subscription_code:  { type: ObjectId , required: true},
    amount: { type: Number, required: true }, 
    occurrence: { type: Number }, 
    status: {
        code: { type: Number, required: true }, 
        description: { type: String, required: true }, 
    }

});


let Invoice = module.exports = mongoose.model('Invoice', invoiceSchema);
