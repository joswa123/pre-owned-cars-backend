'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ReportReason Model
 * Stores selectable report reasons for flagging car listings.
 */
const ReportReason = sequelize.define('ReportReason', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100],
    },
  },
  value: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    validate: {
      is: /^[a-z0-9]+(_[a-z0-9]+)*$/,
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'report_reasons',
  timestamps: true,
  underscored: true,
  getterMethods: {
    isActive() {
      return this.getDataValue('is_active');
    },
    sortOrder() {
      return this.getDataValue('sort_order');
    },
    createdAt() {
      return this.getDataValue('created_at');
    },
    updatedAt() {
      return this.getDataValue('updated_at');
    },
  },
});

module.exports = ReportReason;
