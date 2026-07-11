const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const State = require('./State');

const City = sequelize.define('City', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  state_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: State,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'cities',
  timestamps: true,
});

module.exports = City;