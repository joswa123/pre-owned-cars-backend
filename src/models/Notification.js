const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  requirement_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'requirements', key: 'id' },
    onDelete: 'CASCADE',
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'cars', key: 'id' },
    onDelete: 'CASCADE',
  },
  type: {
    type: DataTypes.STRING(50),
    defaultValue: 'requirement_match',
  },
  message: {
    type: DataTypes.TEXT,
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true,
});

module.exports = Notification;
