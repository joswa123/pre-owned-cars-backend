const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Variant Model
 * Stores vehicle variants under a Model (e.g. VXi, ZXi, Asta IVT).
 */
const Variant = sequelize.define('Variant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  model_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'models',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  fuel_type: {
    type: DataTypes.ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'),
    allowNull: true,
  },
  transmission: {
    type: DataTypes.ENUM('Manual', 'Automatic', 'CVT', 'DCT'),
    allowNull: true,
  },
  engine_cc: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Ex-showroom price estimate',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'variants',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['model_id', 'name'] },
    { fields: ['name'] },
    { fields: ['is_active'] },
  ],
});

module.exports = Variant;
