const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Car = require('./Car');

const CarImage = sequelize.define('CarImage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Car, key: 'id' },
  },
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'car_images',
  timestamps: true,
});

module.exports = CarImage;