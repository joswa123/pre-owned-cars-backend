const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const View = sequelize.define('View', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'cars',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  target_type: {
    type: DataTypes.ENUM('car', 'commercial', 'bike'),
    allowNull: false,
    defaultValue: 'car',
  },
  target_id: {
    type: DataTypes.UUID,
    allowNull: false,
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
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'views',
  timestamps: false,
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
    { unique: true, fields: ['car_id', 'user_id'], name: 'unique_car_user_view' },
    { fields: ['target_type', 'target_id', 'user_id'], name: 'idx_views_target_user' },
    { fields: ['target_type', 'target_id', 'timestamp'], name: 'idx_views_target_timestamp' },
  ],
});

module.exports = View;
