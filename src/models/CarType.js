const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CarType = sequelize.define('CarType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  icon_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'car_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = CarType;