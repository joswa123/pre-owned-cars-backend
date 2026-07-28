// models/Subscription.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  plan: {
    type: DataTypes.ENUM('free_trial', 'basic', 'premium'),
    defaultValue: 'free_trial',
  },
  start_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true, // null means never expires (for free trial)
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  payment_id: {
    type: DataTypes.STRING(100),
    allowNull: true, // Razorpay payment ID
  },
  amount_paid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending',
  },
}, {
  tableName: 'subscriptions',
  timestamps: true,
});

module.exports = Subscription;