const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Requirement = sequelize.define('Requirement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
    onDelete: 'SET NULL',
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  km: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  body_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  transmission: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  board_type: {
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
});

module.exports = Requirement;
