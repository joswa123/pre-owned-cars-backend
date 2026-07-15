// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/database');
// const State = require('./admin-stateModel');
// const User = require('./User');

// const City = sequelize.define('City', {
//     id: {
//         type: DataTypes.UUID,
//         defaultValue: DataTypes.UUIDV4,
//         primaryKey: true,
//     },
//     state_id: {
//         type: DataTypes.UUID,
//         allowNull: true,
//         references: {
//             model: State,
//             key: 'id'
//         }
//     },
//     city_name: {
//         type: DataTypes.STRING(100),
//         allowNull: false,
//     },
//     pin_code: {
//         type: DataTypes.STRING(10),
//         allowNull: false,
//     },  
//     status: {
//         type: DataTypes.ENUM('Active', 'Inactive'),
//         defaultValue: 'Active',
//     },
// }, {
//     tableName: 'cities',
//     timestamps: true,
// })

// module.exports = City;