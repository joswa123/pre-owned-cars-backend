  const { DataTypes } = require('sequelize');
  const sequelize = require('../config/database');
  const User = require('./User');

  const Car = sequelize.define('Car', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    dealer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    brand: { type: DataTypes.STRING(50), allowNull: false },
    model: { type: DataTypes.STRING(50), allowNull: false },
    variant: { type: DataTypes.STRING(50), allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1900, max: new Date().getFullYear() + 1 } },
    purchase_date: { type: DataTypes.DATEONLY, allowNull: false },
    number_plate: { type: DataTypes.STRING(20), allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    exterior_colour: { type: DataTypes.STRING(30), allowNull: false },
    interior_colour: { type: DataTypes.STRING(30), allowNull: false },
    km_driven: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
    fuel_type: { type: DataTypes.ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'), allowNull: false },
    transmission: { type: DataTypes.ENUM('Manual', 'Automatic', 'CVT', 'DCT'), allowNull: false },
    ownership: { type: DataTypes.ENUM('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'), allowNull: false },
    price_negotiable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    car_type: { type: DataTypes.STRING(50), allowNull: false },
    state: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: false,
    }, description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'active', 'inactive', 'sold'), defaultValue: 'pending' },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    tableName: 'cars',
    timestamps: true,
  });

  module.exports = Car;