let mongoose = require("mongoose");

const ObjectId = mongoose.Schema.Types.ObjectId;

let updateSchema = mongoose.Schema({
  created_at: { type: Date, default: Date.now },
  type: { type: String, enum: ["file", "comment"] },
  file: { type: ObjectId, ref: "File" },
  comment: { type: String },
  author: { type: ObjectId, ref: "User" },
  duration: { type: Number, default: 0 },
  transcripted: { type: Boolean, default: false },
  speech: { type: mongoose.Schema.Types.Mixed },
  sentiment: { type: mongoose.Schema.Types.Mixed },
  entities: { type: mongoose.Schema.Types.Mixed },
});

let entrySchema = mongoose.Schema({
  created_at: { type: Date, default: Date.now },
  updates: [updateSchema],
  contact: {
    name: String,
    phone: String,
    email: String,
    birthday: String
  },
  author: { type: ObjectId, required: true, ref: "User" },
  property: { type: ObjectId, required: true, ref: "Property" },
  total_duration: { type: Number, default: 0 },
  info: {
    req: {
      hostname: { type: String },
      ip: { type: String },
      protocol: { type: String }
    },
    user_agent: { type: String },
    referrer: { type: String },
    utm: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      term: { type: String },
      content: { type: String }
    }
  }
});

let Entry = (module.exports = mongoose.model("Entry", entrySchema));
