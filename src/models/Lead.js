// models/Lead.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'cars', key: 'id' },
  },
  buyer_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  buyer_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  buyer_phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  buyer_email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  is_viewed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  contact_unlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  unlocked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'leads',
  timestamps: true,
});

module.exports = Lead;