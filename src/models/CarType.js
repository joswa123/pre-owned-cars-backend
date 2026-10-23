const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CarType = sequelize.define('CarType', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING(70),
    allowNull: false,
    unique: true,
  },
  icon_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  image_public_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 999,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'car_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['slug'],
    },
    {
      fields: ['order'],
    },
  ],
});

module.exports = CarType;