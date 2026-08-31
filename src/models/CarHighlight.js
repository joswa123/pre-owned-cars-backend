const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CarHighlight Junction Model
 * Links cars to predefined highlight tags
 */
const CarHighlight = sequelize.define('CarHighlight', {
  car_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'cars',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  highlight_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'highlights',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'car_highlights',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = CarHighlight;
