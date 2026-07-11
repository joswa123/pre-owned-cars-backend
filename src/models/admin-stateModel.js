const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const State = sequelize.define('State', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    }, 
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    state_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    state_code: {
        type: DataTypes.STRING(10),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('Active', 'Inactive'),
        defaultValue: 'Active',
    },
}, {
    tableName: 'states',
    timestamps: true,
})

module.exports = State;