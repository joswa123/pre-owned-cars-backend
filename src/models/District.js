const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─── District Model ───────────────────────────────────────────────────────────
// Represents an Indian district (taluk/tehsil level).
// Sits between State and City in the 3-level location hierarchy:
//   State → District → City
//
// Example:
//   State:    Tamil Nadu
//   District: Coimbatore
//   City:     Gandhipuram
// ─────────────────────────────────────────────────────────────────────────────
const District = sequelize.define('District', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  // FK → states.id
  // Every district must belong to exactly one state.
  state_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'states', // table name
      key: 'id',
    },
    onDelete: 'CASCADE', // if a state is deleted, remove its districts too
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'districts',
  timestamps: true,

  // Prevent duplicate district names within the same state
  indexes: [
    { unique: true, fields: ['state_id', 'name'] },
  ],
});

module.exports = District;
