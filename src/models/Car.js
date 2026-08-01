const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Car Model
 * Represents pre-owned car listings posted by dealers or sellers.
 * Tracks dealer ownership (dealer_id) and buyer purchase details (buyer_id).
 */
const Car = sequelize.define('Car', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  dealer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  buyer_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    comment: 'Customer user ID who purchased this car when status=sold',
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
  state: { type: DataTypes.STRING(50), allowNull: false },
  city: { type: DataTypes.STRING(50), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive', 'sold'),
    defaultValue: 'pending',
    allowNull: false,
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  number_plate_color: {
    type: DataTypes.ENUM('Own Board', 'T-Board', 'EV'),
    allowNull: false,
    defaultValue: 'Own Board',
  },
  insurance_type: {
    type: DataTypes.ENUM('Comprehensive', 'Third Party', 'Not Insured'),
    allowNull: false,
    defaultValue: 'Not Insured',
  },
  seller_type: {
    type: DataTypes.ENUM('private', 'dealer'),
    allowNull: false,
    defaultValue: 'private',
  },
  appointment_required: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'cars',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['dealer_id'] },
    { fields: ['dealer_id', 'status'] },
    { fields: ['buyer_id'] },
    { fields: ['buyer_id', 'status'] },
    { fields: ['km_driven'] },
    { fields: ['price'] },
    { fields: ['status'] },
    { fields: ['brand'] },
    { fields: ['state', 'city'] }
  ]
});

module.exports = Car;