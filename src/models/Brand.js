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
    // Use VERCEL_URL if available, otherwise BASE_URL, else fallback to localhost
    const base = process.env.BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://pre-owned-cars-backend.onrender.com');
    return `${base}/uploads/brands/${logo}`;
  },
}
}, {
  tableName: 'brands',
  timestamps: true,
});

module.exports = Brand;