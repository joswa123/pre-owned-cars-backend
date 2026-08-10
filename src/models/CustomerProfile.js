const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CustomerProfile Model
 * Represents detailed profile data specifically for users with role='customer'.
 * Establishes a 1-to-1 relationship with the core User model.
 */
const CustomerProfile = sequelize.define('CustomerProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  preferences: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON stringified customer search or car preferences',
  },
  alt_phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
    validate: { is: /^[0-9]{10,15}$/ },
  },
}, {
  tableName: 'customer_profiles',
  timestamps: true,
  underscored: true,
});

module.exports = CustomerProfile;
