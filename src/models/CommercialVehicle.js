const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CommercialVehicle = sequelize.define('CommercialVehicle', {
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
  vehicle_type_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'car_types', key: 'id' },
    onDelete: 'RESTRICT',
  },
  brand_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'brands', key: 'id' },
    onDelete: 'RESTRICT',
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1990,
      max: new Date().getFullYear() + 1,
    },
  },
  fuel_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Diesel',
  },
  ownership: {
    type: DataTypes.ENUM('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'),
    allowNull: false,
  },
  km_driven: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 2000000,
    },
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get() {
      const val = this.getDataValue('price');
      return val !== null && val !== undefined ? Number(val) : val;
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  posted_by_type: {
    type: DataTypes.ENUM('customer', 'dealer'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('sold', 'active', 'deleted', 'expired'),
    allowNull: false,
    defaultValue: 'active',
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  views_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  featured_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL',
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Virtual helper getters
  stateName: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.state?.name || null;
    },
  },
  districtName: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.district?.name || null;
    },
  },
  cityName: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.city?.name || null;
    },
  },
  brandName: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.brand?.name || null;
    },
  },
  vehicleTypeName: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.vehicleType?.name || null;
    },
  },
}, {
  tableName: 'commercial_vehicles',
  timestamps: true,
  paranoid: true, // soft delete via deleted_at
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['vehicle_type_id', 'status', 'created_at'] },
    { fields: ['brand_id', 'status', 'price'] },
    { fields: ['city_id', 'status'] },
    { fields: ['user_id', 'status'] },
    { fields: ['status', 'created_at'] },
    { unique: true, fields: ['slug'] },
  ],
});

module.exports = CommercialVehicle;

