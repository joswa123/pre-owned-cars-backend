// Import User model
// Represents the users table in MySQL
const User = require('./User');
const Otp = require('./Otp');
const State = require('./State');
const City = require('./City');
const Car = require('./Car');
const CarImage = require('./CarImage');

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


User.hasMany(Car, { foreignKey: 'dealer_id' });
Car.belongsTo(User, { foreignKey: 'dealer_id' });

Car.hasMany(CarImage, { foreignKey: 'car_id', as: 'images' });
CarImage.belongsTo(Car, { foreignKey: 'car_id' });

State.hasMany(City, { foreignKey: 'state_id' });
City.belongsTo(State, { foreignKey: 'state_id' });

// Export all models
// So other files can import them like:
//
// const { User, Otp } = require('../models');
//
module.exports = {
  User,
  Otp,
  Car,
  CarImage,
  State,
  City,
};