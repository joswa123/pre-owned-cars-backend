const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Highlight Model
 * Predefined tags/features of cars (e.g., "Excellent Condition", "Less Driven", "VIP Number")
 */
const Highlight = sequelize.define('Highlight', {
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
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'highlights',
  timestamps: true,
  underscored: true,
});

module.exports = Highlight;
