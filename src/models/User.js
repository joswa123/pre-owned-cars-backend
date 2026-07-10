const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      len: [10, 10],
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('buyer', 'seller', 'company_seller','admin'),
    defaultValue: 'buyer',
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  last_login: {
    type: DataTypes.DATE,
  },

  email: {
  type: DataTypes.STRING(100),
  allowNull: true,
  validate: { isEmail: true },
},
address: {
  type: DataTypes.TEXT,
  allowNull: true,
},
city: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
state: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
pincode: {
  type: DataTypes.STRING(6),
  allowNull: true,
  validate: { len: [6, 6] },
},
aadhaar: {
  type: DataTypes.STRING(12),
  allowNull: true,
  validate: { len: [12, 12] },
},
company_name: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
license_no: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
gst_no: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
contact_person: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
}, {
  tableName: 'users',
  timestamps:true,
});

module.exports = User;