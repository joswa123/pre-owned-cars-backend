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
      if (!this.getDataValue('logo')) return null;
      const publicPath = process.env.BASE_URL || 'http://repose-anthill-durably.ngrok-free.dev';
      return `${publicPath}/uploads/brands/${this.getDataValue('logo')}`;
    },
  },
}, {
  tableName: 'brands',
  timestamps: true,
});

module.exports = Brand;