const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Car = require('./Car');

// models/CarImage.js

const CarImage = sequelize.define('CarImage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  car_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'cars', key: 'id' } },
  image_url: { type: DataTypes.STRING(255), allowNull: false },
  is_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'car_images', timestamps: true });

module.exports = CarImage;
module.exports = CarImage;