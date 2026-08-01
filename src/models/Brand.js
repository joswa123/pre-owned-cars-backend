const path = require('path');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Brand Model
 * Stores vehicle manufacturers (e.g. Maruti Suzuki, Hyundai, Tata).
 */
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
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Soft deletion / active catalog flag',
  },
  logoUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      const logo = this.getDataValue('logo');
      if (!logo) return null;
      if (logo.startsWith('http://') || logo.startsWith('https://')) {
        return logo;
      }
      const filename = path.basename(logo);
      const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
      return `${baseUrl}/uploads/brands/${filename}`;
    },
  },
}, {
  tableName: 'brands',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['name'] },
    { fields: ['is_active'] },
  ],
});

module.exports = Brand;