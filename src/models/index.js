// Import User model
// Represents the users table in MySQL
const User = require('./User');

// Import Otp model
// Represents the otp_verifications table in MySQL
const Otp = require('./Otp');


// =========================
// MODEL RELATIONSHIPS
// =========================

// One User can have ONE OTP record
//
// Example:
// User:
// {
//   id: "123",
//   name: "Joswa"
// }
//
// OTP:
// {
//   user_id: "123",
//   otp: "654321"
// }
//
// user_id is the foreign key stored in otp_verifications table
User.hasOne(Otp, {
  foreignKey: 'user_id', // column in otp_verifications table
  as: 'otpRecord'        // alias name used when fetching relations
});


// One OTP belongs to ONE User
//
// Example:
// OTP 654321 belongs to User Joswa
Otp.belongsTo(User, {
  foreignKey: 'user_id'
});


// Export all models
// So other files can import them like:
//
// const { User, Otp } = require('../models');
//
module.exports = {
  User,
  Otp
};