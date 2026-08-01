const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * DealerProfile Model
 * Represents detailed business profile data specifically for users with role='dealer'.
 * Establishes a 1-to-1 relationship with the core User model.
 */
const DealerProfile = sequelize.define('DealerProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  company_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  door_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  building_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  street_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  pincode: {
    type: DataTypes.STRING(6),
    allowNull: false,
    validate: {
      len: [6, 6],
    },
  },
  gst_no: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  license_no: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  contact_person: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Dealer business document verification flag',
  },
}, {
  tableName: 'dealer_profiles',
  timestamps: true,
  underscored: true,
});

module.exports = DealerProfile;
