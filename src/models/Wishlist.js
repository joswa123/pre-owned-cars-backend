const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Wishlist = sequelize.define('Wishlist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'cars', key: 'id' },
  },
  target_type: {
    type: DataTypes.ENUM('car', 'commercial'),
    allowNull: false,
    defaultValue: 'car',
  },
  target_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'wishlists',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (instance) => {
      if (!instance.target_type) {
        instance.target_type = 'car';
      }
      if (!instance.target_id && instance.car_id) {
        instance.target_id = instance.car_id;
      }
      if (!instance.car_id && instance.target_id && instance.target_type === 'car') {
        instance.car_id = instance.target_id;
      }
    },
  },
  indexes: [
    { unique: true, fields: ['user_id', 'car_id'] },
    { unique: true, fields: ['user_id', 'target_type', 'target_id'] },
  ]
});

module.exports = Wishlist;
