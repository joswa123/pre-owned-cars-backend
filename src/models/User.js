const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const State = require('./State');
const City = require('./City');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      len: [10, 10],
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('buyer', 'seller' ,'admin'),
    defaultValue: 'buyer',
  },
  seller_type: {
    type: DataTypes.ENUM('individual', 'company'),
    allowNull: true,
  },
  profile_picture: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: { isEmail: true },
  },
  aadhaar: {
    type: DataTypes.STRING(12),
    allowNull: true,
    validate: { len: [12, 12] },
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  city_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'cities', // name of the City model
      key: 'id',
    },
  },
  state_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'states', // name of the State model
      key: 'id',
    },
  },
  pincode: {
    type: DataTypes.STRING(6),
    allowNull: true,
    validate: { len: [6, 6] },
  },
  status: {
    type: DataTypes.ENUM('approved', 'pending', 'rejected'),
    defaultValue: 'pending',
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  last_login: {
    type: DataTypes.DATE,
  },
  }, {
    tableName: 'users',
    timestamps:true,
});

module.exports = User;