'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * VehicleType Model
 * Represents vehicle body / commercial types (e.g. Sedan, SUV, Trucks, Buses, Tractors).
 * Stored in `car_types` table for unified catalog management and backward compatibility.
 */
const VehicleType = sequelize.define('VehicleType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING(70),
    allowNull: false,
    unique: true,
  },
  icon_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  image_public_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 999,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  category_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id',
    },
    comment: 'Links to categories (Car, Commercial, Bike, etc.)',
  },
}, {
  tableName: 'car_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['slug'],
    },
    {
      fields: ['order'],
    },
    {
      fields: ['category_id'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = VehicleType;
