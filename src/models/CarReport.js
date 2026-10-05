// models/CarReport.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CarReport = sequelize.define('CarReport', {
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
  dealer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  reporter_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  reporter_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  reporter_phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_review', 'resolved', 'dismissed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'car_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status', 'created_at'] },
    { fields: ['car_id'] },
    { fields: ['dealer_id'] },
  ],
});

module.exports = CarReport;
