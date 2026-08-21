const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CarInteraction Model
 * High-scale event log for all customer interactions: views, calls, WhatsApp, messages, enquiries, wishlist
 */
const CarInteraction = sequelize.define('CarInteraction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'cars',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
  type: {
    type: DataTypes.ENUM('view', 'call', 'whatsapp', 'message', 'enquiry', 'wishlist'),
    allowNull: false,
    defaultValue: 'view',
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'car_interactions',
  timestamps: false,
  indexes: [
    { fields: ['car_id', 'type', 'created_at'] },
    { fields: ['user_id', 'created_at'] },
  ],
});

module.exports = CarInteraction;
