const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Otp = sequelize.define('Otp', {
  id: {
    type: DataTypes.INTEGER,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  otp: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('register', 'reset_password'),
    defaultValue: 'register',
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  // Remove phone and email fields; they don't exist in the new schema
}, {
  tableName: 'otp_verifications', // ← match existing table name
  timestamps: true,
});

module.exports = Otp;