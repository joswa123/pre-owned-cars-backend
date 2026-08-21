const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CarStat Model
 * Pre-aggregated summary metrics for O(1) seller inventory querying without subquery scans
 */
const CarStat = sequelize.define('CarStat', {
  car_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: {
      model: 'cars',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  views_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  calls_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  whatsapp_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  messages_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  enquiries_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  wishlist_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'car_stats',
  timestamps: true,
  underscored: true,
});

module.exports = CarStat;
