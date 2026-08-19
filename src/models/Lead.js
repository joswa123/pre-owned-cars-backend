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
  user_id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('buyer_id');
    },
    set(val) {
      this.setDataValue('buyer_id', val);
    },
  },
  buyer_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  buyer_phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  buyer_email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  seller_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  contact_phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  preferred_contact: {
    type: DataTypes.ENUM('whatsapp', 'phone', 'email'),
    allowNull: false,
    defaultValue: 'phone',
  },
  source: {
    type: DataTypes.ENUM('call', 'whatsapp', 'message', 'chat'),
    allowNull: false,
    defaultValue: 'message',
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'closed'),
    allowNull: false,
    defaultValue: 'new',
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
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'leads',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['seller_id', 'status'] },
    { fields: ['car_id'] },
    { fields: ['buyer_id'] },
    { fields: ['created_at'] },
  ],
});

module.exports = Lead;