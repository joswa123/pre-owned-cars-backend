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
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'views',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['car_id', 'user_id'], name: 'unique_car_user_view' }
  ]
});

module.exports = View;
