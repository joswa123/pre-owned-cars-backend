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
    allowNull: true,
    references: { model: 'cars', key: 'id' },
  },
  target_type: {
    type: DataTypes.ENUM('car', 'commercial'),
    allowNull: false,
    defaultValue: 'car',
  },
  target_id: {
    type: DataTypes.UUID,
    allowNull: false,
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
  hooks: {
    beforeValidate: (instance) => {
      if (!instance.target_type) {
        instance.target_type = 'car';
      }
      if (!instance.target_id && instance.car_id) {
        instance.target_id = instance.car_id;
      }
      if (!instance.car_id && instance.target_id && instance.target_type === 'car') {
        instance.car_id = instance.target_id;
      }
    },
  },
  indexes: [
    { fields: ['status', 'created_at'] },
    { fields: ['car_id'] },
    { fields: ['dealer_id'] },
    { fields: ['target_type', 'target_id', 'status'] },
  ],
});

module.exports = CarReport;
