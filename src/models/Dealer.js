// const { DataTypes } = require('sequelize'); 
// const sequelize = require('../config/database');
// const State = require('./State');
// const City = require('./City');

// const Dealer = sequelize.define('Dealer', {
//     id: {
//         type: DataTypes.UUID,
//         defaultValue: DataTypes.UUIDV4,
//         primaryKey: true,
//     },
//     user_id: {
//         type: DataTypes.UUID,
//         allowNull: false,
//     },
//     company_name: {
//         type: DataTypes.STRING(200),
//         allowNull: false,
//     },
//     license_no: {
//         type: DataTypes.STRING(200),
//         allowNull: false,
//     },
//     gst_no: {
//         type: DataTypes.STRING(100),
//         allowNull: false,
//     },
//     constact_person: {
//         type: DataTypes.STRING(100),
//         allowNull: false,
//     },
//     cp_phone: {
//         type: DataTypes.STRING(10),
//         allowNull: false,
//         unique: true,
//         validate: {
//             len: [10, 10],
//         },
//     },
//     cp_email: {
//         type: DataTypes.STRING(100),
//         allowNull: false,
//         validate: { isEmail: true },
//     },
//     cp_address: {
//         type: DataTypes.TEXT,
//         allowNull: false,
//     },
//     cp_city_id: {
//         type: DataTypes.UUID,
//         allowNull: false,
//         references: {
//             model: City, // name of the City model
//             key: 'id',
//         },
//     },
//     cp_state_id: {
//         type: DataTypes.UUID,
//         allowNull: false,
//         references: {
//             model: State, // name of the State model
//             key: 'id',
//         },
//     },
    
// }, {
//     tableName: 'dealers',
//     timestamps: true,
// });