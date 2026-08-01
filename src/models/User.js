const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Core User Model
 * Stores identity, credentials, verification status, and location references.
 * Role is strictly enforced as 'customer' or 'dealer' (with internal 'admin').
 * Detailed profiles are offloaded to CustomerProfile and DealerProfile models.
 */
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
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: { isEmail: true },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('customer', 'dealer', 'admin'),
    defaultValue: 'customer',
    allowNull: false,
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  last_login: {
    type: DataTypes.DATE,
  },
  // Location Hierarchy References
  state_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'states',
      key: 'id',
    },
  },
  district_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'districts',
      key: 'id',
    },
  },
  city_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'cities',
      key: 'id',
    },
  },
  // Cached text names for location
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('approved', 'pending', 'rejected'),
    defaultValue: 'approved',
  },
  profile_picture: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['phone'] },
    { unique: true, fields: ['email'], where: { email: { $ne: null } } },
    { fields: ['role'] },
    { fields: ['city_id'] },
    { fields: ['district_id'] },
    { fields: ['state_id'] },
  ],
});

module.exports = User;