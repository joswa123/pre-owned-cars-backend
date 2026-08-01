const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─── City Model ───────────────────────────────────────────────────────────────
// Represents a city/town/village within a district.
// Location hierarchy: State → District → City
//
// Example:
//   State:    Tamil Nadu
//   District: Coimbatore
//   City:     Gandhipuram  ← this model
// ─────────────────────────────────────────────────────────────────────────────
const City = sequelize.define('City', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  // FK → states.id (kept for backward compatibility — direct state linkage)
  state_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'states',
      key: 'id',
    },
  },

  // FK → districts.id (new — the direct parent in the 3-level hierarchy)
  // Nullable for backward compatibility with cities seeded before districts existed.
  district_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'districts',
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