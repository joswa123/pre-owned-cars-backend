const path = require('path');
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
  logoUrl: {
  type: DataTypes.VIRTUAL,
  get() {
    const logo = this.getDataValue('logo');
    if (!logo) return null;
     // If it's already a full URL (Cloudinary), return as is
    if (logo.startsWith('http://') || logo.startsWith('https://')) {
      return logo;
    }

    // Fallback for old local paths: extract just the filename
    const filename = path.basename(logo);
    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
    return `${baseUrl}/uploads/brands/${filename}`;
  },
}
}, {
  tableName: 'brands',
  timestamps: true,
});

module.exports = Brand;