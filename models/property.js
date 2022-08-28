let mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId



let propertySchema = mongoose.Schema({
    created_at: { type: Date, default: Date.now },
    author: { type: ObjectId, required: true, ref: 'User' },
    notifications: { type: String },
    integrations: [{
        integration: { type: ObjectId, required: true, ref: 'Integration' },
        data: { type: mongoose.Schema.Types.Mixed },
        status: { type: String, required: true, default: 'ENABLED', enum: ['ENABLED', 'DISABLED'] },
    }],
    permissions: [{
        user: { type: ObjectId, required: true, ref: 'User' },
        role: { type: String, required: true, default: 'OWNER', enum: ['WATCHER', 'EDITOR', 'ADMIN', 'OWNER'] },
    }],
    domain: { type: String, required: true, lowercase: true, trim: true, index: true, text: true },
    status: { type: String, required: true, default: 'ACTIVE', enum: ['ACTIVE', 'STOPPED', 'TERMINATED'] },
    name: { type: String, required: true, index: true, text: true },
    metrics: {
        hits: { type: Number, default: 0 }, // Quantas vezes o script foi carregado
        seconds_transcripted: { type: Number, default: 0 },
        entries_analysed: { type: Number, default: 0 },
        updated_at: {}
    },
    current_interval: {
        started_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
        hits: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 100 },
        },
        seconds_transcripted: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 60 },
        },
        seconds_recorded: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 600 },
        },
        entries_analysed: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 2 },
        },
        entries: {
            used: { type: Number, default: 0 },
            limit: { type: Number, default: 10 },
        },
    },
    subscription: {
        updated_at: { type: Date, default: Date.now },
        amount: { type: Number },
        creation_date: {
            month: { type: Number },
            year: { type: Number },
            day: { type: Number },
        },
        plan: {
            code: { type: String, required: true, default: 'free' }
        },
        status: { type: String, default: 'NOTVERIFIED', enum: ["NOTVERIFIED", "VERIFIED", "ACTIVE", "SUSPENDED", "EXPIRED", "OVERDUE", "CANCELED", "TRIAL"] },
        expiration_date: {
            month: { type: Number },
            year: { type: Number },
            day: { type: Number },
        },
        next_invoice_date: {
            month: { type: Number },
            year: { type: Number },
            day: { type: Number },
        },
        payment_method: { type: String, default: 'CREDIT_CARD' },
        code: { type: String }, // Aponta pro próprio ID
        customer: {
            code: { type: ObjectId, ref: 'User' }, // Aponta pro usuário
        }

    },
    wallet: {
        hits: {
            used: { type: Number, default: 0 },
            avaiable: { type: Number, default: 0 },
        },
        seconds_transcripted: {
            used: { type: Number, default: 0 },
            avaiable: { type: Number, default: 0 },
        },
        entries_analysed: {
            used: { type: Number, default: 0 },
            avaiable: { type: Number, default: 0 },
        },
    },
    embed: {
        color: { type: String, default: "gradient" },
        fields: {
            name: { type: Boolean, default: false },
            phone: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            message: { type: Boolean, default: false },
        },
        watermark: { type: Boolean, default: true },
        messages: {
            initial: { type: String, default: 'Deixe sua mensagem de voz' },
            record: { type: String, default: 'Gravar' },
            button: { type: String, default: 'Enviar' },
            instructions: { type: String, default: 'Tudo pronto para mandar sua mensagem!' },
            success: { type: String, default: 'Sua mensagem foi enviada com sucesso!' },
        }
    }
});


let Property = module.exports = mongoose.model('Property', propertySchema);
