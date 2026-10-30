'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Brand Model
 * Stores vehicle manufacturers (e.g. Maruti Suzuki, Hyundai, Tata, Ashok Leyland).
 */
const Brand = sequelize.define('Brand', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  logo: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  type_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'car_types',
      key: 'id',
    },
    comment: 'Primary or direct linked vehicle type (fallback / 1-to-many link)',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Soft deletion / active catalog flag',
  },
  external_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true,
  },
  logoUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('logo');
    },
  },
  logo_url: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('logo');
    },
  },
}, {
  tableName: 'brands',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['name'] },
    { unique: true, fields: ['external_id'] },
    { fields: ['slug'] },
    { fields: ['type_id'] },
    { fields: ['is_active'] },
  ],
});

module.exports = Brand;