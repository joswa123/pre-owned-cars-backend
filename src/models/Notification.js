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
    allowNull: true,
    references: { model: 'cars', key: 'id' },
    onDelete: 'CASCADE',
  },
  target_type: {
    type: DataTypes.ENUM('car', 'commercial'),
    allowNull: false,
    defaultValue: 'car',
  },
  target_id: {
    type: DataTypes.UUID,
    allowNull: true,
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
    { fields: ['target_type', 'target_id'] },
  ],
});

module.exports = Notification;
