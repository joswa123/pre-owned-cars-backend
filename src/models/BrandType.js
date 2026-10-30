'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * BrandType Junction Model
 * Many-to-Many junction table connecting Brand and VehicleType (car_types).
 */
const BrandType = sequelize.define('BrandType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  brand_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'brands',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  type_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'car_types',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'brand_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['brand_id', 'type_id'],
      name: 'idx_brand_types_brand_type_unique',
    },
    {
      fields: ['type_id'],
      name: 'idx_brand_types_type_id',
    },
    {
      fields: ['brand_id'],
      name: 'idx_brand_types_brand_id',
    },
  ],
});

module.exports = BrandType;
