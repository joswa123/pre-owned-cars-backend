const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model Model
 * Stores vehicle models under a Brand (e.g. Swift, Creta, Nexon).
 */
const Model = sequelize.define('Model', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  brandId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'brand_id',
    references: {
      model: 'brands',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  body_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'SUV, Sedan, Hatchback, MUV, etc.',
  },
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  start_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  end_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Soft deletion / active status flag',
  },
}, {
  tableName: 'models',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['brand_id', 'name'] },
    { fields: ['name'] },
    { fields: ['is_active'] },
  ],
});

module.exports = Model;