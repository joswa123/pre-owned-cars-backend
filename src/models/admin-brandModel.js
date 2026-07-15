const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Brand = sequelize.define('Brand', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User, // Name of the referenced table
            key: 'id',      // Column in the referenced table
        },
    },
    brand_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    brand_logo_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('Active', 'Inactive'),
        defaultValue: 'Active',
    },
}, {
    tableName: 'brands',
    timestamps: true,
});

module.exports = Brand;