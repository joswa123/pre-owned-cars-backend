// Import User model
// Represents the users table in MySQL
const User = require('./User');
const Otp = require('./Otp');
const Car = require('./Car');
const CarImage = require('./CarImage');
const Brand = require('./Brand');
const Model= require('./Model');
const FuelType = require('./FuelType');
const Transmission = require('./Transmission');
const CarType = require('./CarType');const City = require('./City');
const State = require('./State');
const Brand = require('./admin-brandModel');

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

// // One User can have many State records
// User.hasMany(State, { foreignKey: 'user_id', as: 'stateRecords' });

// State.belongsTo(User, { foreignKey: 'user_id' });

// // One User can have many City records
// User.hasMany(City, {
//   foreignKey: 'user_id',
//   as: 'cityRecords'
// });

// City.belongsTo(User, {
//   foreignKey: 'user_id'
// });

// // One State can have many City records
// State.hasMany(City, {
//   foreignKey: 'state_id',
//   as: 'cityRecords'
// });

// City.belongsTo(State, {
//   foreignKey: 'state_id'
// });

// One User can have many Brand records
User.hasMany(Brand, {
  foreignKey: 'user_id',
  as: 'brandRecords'
});

Brand.belongsTo(User, {
  foreignKey: 'user_id'
});

// One State can have many User records
State.hasMany(User, {
  foreignKey: 'state_id',
});

User.belongsTo(State, {
  foreignKey: 'state_id'
});

// One City can have many User records
City.hasMany(User, {
  foreignKey: 'city_id',
});

User.belongsTo(City, {
  foreignKey: 'city_id'
});



// Export all models
// So other files can import them like:
//
// const { User, Otp } = require('../models');
//

Brand.hasMany(Model, { foreignKey: 'brandId', onDelete: 'CASCADE' });
Model.belongsTo(Brand, { foreignKey: 'brandId' });
FuelType.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });
User.hasMany(FuelType, { foreignKey: 'user_id' });

Transmission.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });
User.hasMany(Transmission, { foreignKey: 'user_id' });


module.exports = {
  User,
  Otp,
  Car,
  CarImage,
  State,
  City,
  Brand,
  Model,
  FuelType,
  Transmission,
  CarType
  Brand
};