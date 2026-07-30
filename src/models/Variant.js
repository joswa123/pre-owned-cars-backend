const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Variant = sequelize.define('Variant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  model_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'models',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'variants',
  timestamps: true,
});

module.exports = Variant;
