const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Car Model
 * Represents pre-owned car listings posted by customers or dealers.
 * Includes posted_by_type (customer | dealer), b2b_listing flag, body_type, board_type, color, number_plate, and prior_appointments.
 */
const Car = sequelize.define('Car', {
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
    comment: 'ID of the user (customer or dealer) who posted this car listing',
  },
  state_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'states', key: 'id' },
    onDelete: 'SET NULL',
  },
  district_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'districts', key: 'id' },
    onDelete: 'SET NULL',
  },
  city_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'cities', key: 'id' },
    onDelete: 'SET NULL',
  },

  brand_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'brands', key: 'id' },
    onDelete: 'RESTRICT',
  },
  brandName: {
    type: DataTypes.VIRTUAL,
    get() {
      // NOTE: Only populated if `brand` association is eager-loaded!
      return this.brand?.name || null;
    }
  },
  model: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  variant: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1900, max: new Date().getFullYear() + 1 },
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  price_negotiable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  km_driven: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0 },
  },
  fuel_type: {
    type: DataTypes.ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG'),
    allowNull: false,
  },
  transmission: {
    type: DataTypes.ENUM('Manual', 'Automatic', 'AMT', 'CVT', 'DCT'),
    allowNull: false,
  },
  ownership: {
    type: DataTypes.ENUM('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'),
    allowNull: false,
  },
  body_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Car body type: Sedan, Hatchback, SUV, MUV, Estate, Crossover, Coupe, Convertible, Pickup, Van Minivan, Wagon, Sports Car, Notchback, Sports sedan, Others',
  },
  board_type: {
    type: DataTypes.ENUM('OWN BOARD', 'T-BOARD', 'COMMERCIAL'),
    allowNull: false,
    defaultValue: 'OWN BOARD',
  },
  insurance_expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  insurance_type: {
    type: DataTypes.ENUM('Comprehensive', 'Third Party', 'Not Insured'),
    allowNull: false,
    defaultValue: 'Not Insured',
  },
  b2b_listing: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if listing is dealer-to-dealer (B2B)',
  },
  posted_by_type: {
    type: DataTypes.ENUM('customer', 'dealer'),
    allowNull: false,
    comment: 'Role of the seller who posted the car (customer or dealer)',
  },
  status: {
    type: DataTypes.ENUM('sold', 'active', 'deleted', 'expired'),
    allowNull: false,
    defaultValue: 'active',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  prior_appointemnts: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Flag indicating whether prior appointment is required for this car',
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '',
    comment: 'Color of the car',
  },
  number_plate: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '',
    comment: 'Registration number plate of the car (e.g. TN01AB1234)',
  },
  prior_appointments: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('prior_appointemnts');
    },
    set(value) {
      this.setDataValue('prior_appointemnts', value);
    },
    comment: 'Virtual alias for prior_appointemnts for standard naming compatibility',
  },
  location_text: {
    type: DataTypes.VIRTUAL,
    get() {
      const parts = [];
      if (this.city?.name) parts.push(this.city.name);
      if (this.district?.name) parts.push(this.district.name);
      if (this.state?.name) parts.push(this.state.name);
      return parts.length > 0 ? parts.join(', ') : null;
    }
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'cars',
  timestamps: true,
  underscored: true,
  defaultScope: {
    where: {
      status: {
        [require('sequelize').Op.ne]: 'deleted'
      }
    }
  },
  indexes: [
    { fields: ['user_id'] },
    { fields: ['posted_by_type'] },
    { fields: ['b2b_listing'] },
    { fields: ['status'] },
    { fields: ['brand_id'] },
    { fields: ['price'] },
    { fields: ['km_driven'] },
    { fields: ['body_type'] },
    { fields: ['fuel_type'] },
    { fields: ['transmission'] },
    { fields: ['color'] },
    { fields: ['state_id'] },
    { fields: ['district_id'] },
    { fields: ['city_id'] },
    // Composite indexes for fast filtering
    { fields: ['status', 'board_type'] },
    { fields: ['status', 'b2b_listing'] },
    { fields: ['status', 'brand_id'] },
  ],
});

module.exports = Car;