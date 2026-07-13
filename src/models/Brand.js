const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // your sequelize instance

const Brand = sequelize.define('Brand', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  logo: {
    type: DataTypes.STRING(255),
    allowNull: true, // store file path (e.g., 'uploads/brands/logo123.jpg')
  },
}, {
  tableName: 'brands',
  timestamps: true,
});

module.exports = Brand;