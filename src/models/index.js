// Import User model
// Represents the users table in MySQL
const User = require('./User');
const Otp = require('./Otp');
const State = require('./State');
const City = require('./City');
const Car = require('./Car');
const CarImage = require('./CarImage');
const Brand = require('./Brand');
const Model= require('./Model');
const Variant = require('./Variant');
const FuelType = require('./FuelType');
const Transmission = require('./Transmission');
const CarType = require('./CarType');
const RefreshToken=require('./RefreshToken')
const Wishlist=require('./Wishlist')
const Lead = require('./Lead')
const Subscription = require('./Subscription')
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

Brand.hasMany(Model, { foreignKey: 'brandId', onDelete: 'CASCADE' });
Model.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand'});

Model.hasMany(Variant, { foreignKey: 'model_id', onDelete: 'CASCADE' });
Variant.belongsTo(Model, { foreignKey: 'model_id', as: 'model'});
FuelType.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });
User.hasMany(FuelType, { foreignKey: 'user_id' });

Transmission.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });
User.hasMany(Transmission, { foreignKey: 'user_id' });

RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RefreshToken, { foreignKey: 'user_id' });


Wishlist.belongsTo(User, { foreignKey: 'user_id' });
Wishlist.belongsTo(Car, { foreignKey: 'car_id' });
User.hasMany(Wishlist, { foreignKey: 'user_id' });
Car.hasMany(Wishlist, { foreignKey: 'car_id' });

// Leads Associations
Car.hasMany(Lead, { foreignKey: 'car_id' });
Lead.belongsTo(Car, { foreignKey: 'car_id', as: 'car' });
User.hasMany(Lead, { foreignKey: 'buyer_id', as: 'buyerLeads' });
Lead.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
User.hasMany(Lead, { foreignKey: 'seller_id', as: 'sellerLeads' });
Lead.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

// Subscriptions Associations
User.hasMany(Subscription, { foreignKey: 'seller_id' });
Subscription.belongsTo(User, { foreignKey: 'seller_id' });
const models = {
  User,
  Otp,
  Car,
  CarImage,
  State,
  City,
  Brand,
  Model,
  Variant,
  FuelType,
  Transmission,
  CarType,
  RefreshToken,
  Wishlist,
  Lead,
  Subscription
};

// Polyfill for Sequelize v3 compatibility where modern code expects findByPk
Object.values(models).forEach(model => {
  if (model && typeof model.findById === 'function') {
    model.findByPk = model.findById;
  }
});

module.exports = models;