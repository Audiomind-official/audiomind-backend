const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let userSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true, dropDups: true },
  fullname: String,
  hash: String,
  salt: String,
  password_reset_token: String,
  password_reset_token_expires: { type: Date },
  permissions: { type: String, default: 'CLIENT', enum: ['CLIENT', 'AGENT', 'ADMIN'] },
  created_at: { type: Date, default: Date.now },
  billing: {
    customer: {
      email: String,
      fullname: String,
      cpf:String,
      phone_area_code: String,
      phone_number: String,
      birthdate_day: String,
      birthdate_month: String,
      birthdate_year: String,
      address: { type: mongoose.Schema.Types.Mixed},
      code: String,
    },
  }
});

userSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

userSchema.methods.setPasswordResetToken = function () {
  const today = new Date();
  const expirationDate = new Date(today);
  expirationDate.setDate(today.getDate() + 1);

  this.password_reset_token = crypto.randomBytes(16).toString('hex');
  this.password_reset_token_expires = expirationDate.getTime();
};

userSchema.methods.validatePassword = function (password) {
  const hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
  return this.hash === hash;
};

userSchema.methods.generateJWT = function () {
  const today = new Date();
  const expirationDate = new Date(today);
  expirationDate.setDate(today.getDate() + 1);

  return jwt.sign({
    email: this.email,
    id: this._id,
    permissions: this.permissions,
    exp: parseInt(expirationDate.getTime() / 1000, 10),
  }, 'secret');
}

userSchema.methods.toAuthJSON = function () {
  return {
    _id: this._id,
    email: this.email,
    permissions: this.permissions,
    token: this.generateJWT(),
  };
};

let User = module.exports = mongoose.model('User', userSchema);