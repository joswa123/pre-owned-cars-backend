// Import Core Models
const User = require('./User');
const CustomerProfile = require('./CustomerProfile');
const DealerProfile = require('./DealerProfile');
const Otp = require('./Otp');
const State = require('./State');
const District = require('./District');
const City = require('./City');
const Car = require('./Car');
const CarImage = require('./CarImage');
const Brand = require('./Brand');
const Model = require('./Model');
const Variant = require('./Variant');
const FuelType = require('./FuelType');
const Transmission = require('./Transmission');
const CarType = require('./CarType');
const RefreshToken = require('./RefreshToken');
const Wishlist = require('./Wishlist');
const Lead = require('./Lead');
const Subscription = require('./Subscription');

// ==========================================
// USER & PROFILE RELATIONSHIPS (1-to-1)
// ==========================================
User.hasOne(CustomerProfile, {
  foreignKey: 'user_id',
  as: 'customerProfile',
  onDelete: 'CASCADE',
});
CustomerProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

User.hasOne(DealerProfile, {
  foreignKey: 'user_id',
  as: 'dealerProfile',
  onDelete: 'CASCADE',
});
DealerProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// ==========================================
// OTP RELATIONSHIPS
// ==========================================
User.hasOne(Otp, {
  foreignKey: 'user_id',
  as: 'otpRecord',
});
Otp.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// ==========================================
// CAR & USER / BUYER RELATIONSHIPS
// ==========================================
User.hasMany(Car, { foreignKey: 'user_id', as: 'postedCars' });
Car.belongsTo(User, { foreignKey: 'user_id', as: 'seller' });



Car.hasMany(CarImage, { foreignKey: 'car_id', as: 'images' });
CarImage.belongsTo(Car, { foreignKey: 'car_id' });

// ==========================================
// LOCATION HIERARCHY (State → District → City)
// ==========================================
State.hasMany(District, { foreignKey: 'state_id', as: 'districts' });
District.belongsTo(State, { foreignKey: 'state_id', as: 'state' });

District.hasMany(City, { foreignKey: 'district_id', as: 'cities' });
City.belongsTo(District, { foreignKey: 'district_id', as: 'district' });

State.hasMany(City, { foreignKey: 'state_id', as: 'cities' });
City.belongsTo(State, { foreignKey: 'state_id', as: 'state' });

// User location linkages
User.belongsTo(State, { foreignKey: 'state_id', as: 'stateDetail' });
User.belongsTo(District, { foreignKey: 'district_id', as: 'districtDetail' });
City.hasMany(User, { foreignKey: 'city_id', as: 'users' });
User.belongsTo(City, { foreignKey: 'city_id', as: 'cityDetail' });

// ==========================================
// CATALOG & OTHER RELATIONSHIPS
// ==========================================
Brand.hasMany(Model, { foreignKey: 'brandId', onDelete: 'CASCADE' });
Model.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand' });

Model.hasMany(Variant, { foreignKey: 'model_id', onDelete: 'CASCADE' });
Variant.belongsTo(Model, { foreignKey: 'model_id', as: 'model' });

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
  CustomerProfile,
  DealerProfile,
  Otp,
  Car,
  CarImage,
  State,
  District,
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
  Subscription,
};

// Polyfill for Sequelize v3 compatibility where modern code expects findByPk
Object.values(models).forEach(model => {
  if (model && typeof model.findById === 'function') {
    model.findByPk = model.findById;
  }
});

module.exports = models;