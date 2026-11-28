const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Requirement = sequelize.define('Requirement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  target_type: {
    type: DataTypes.ENUM('car', 'commercial', 'bike'),
    allowNull: false,
    defaultValue: 'car',
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
  brand_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'brands', key: 'id' },
    onDelete: 'RESTRICT',
  },
  model_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'models', key: 'id' },
    onDelete: 'RESTRICT',
  },
  vehicle_type_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'car_types', key: 'id' },
    onDelete: 'SET NULL',
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  min_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  max_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  min_km: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  max_km: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  body_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
  },
  transmission: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
  },
  board_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  purchase_plan_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'bought', 'deleted'),
    defaultValue: 'active',
    allowNull: false,
  },
  bought_from: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'requirements',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeValidate: (instance) => {
      if (!instance.target_type) {
        instance.target_type = instance.vehicle_type_id ? 'commercial' : 'car';
      }
    },
  },
  indexes: [
    { fields: ['user_id', 'status'] },
    { fields: ['target_type', 'status', 'expiry_date'] },
    { fields: ['target_type', 'brand_id', 'vehicle_type_id'] },
  ],
});

module.exports = Requirement;
