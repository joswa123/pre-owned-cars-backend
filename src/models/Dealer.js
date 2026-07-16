const { DataTypes } = require('sequelize'); 
const sequelize = require('../config/database');
const State = require('./State');
const City = require('./City');

const Dealer = sequelize.define('Dealer', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users', // name of the User model
            key: 'id',
        },
    },
    company_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    license_no: {
        type: DataTypes.STRING(200),
        allowNull: false,
        unique: true,
    },
    gst_no: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    contact_person: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    cp_phone: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        validate: {
            len: [10, 10],
        },
    },
    cp_email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { isEmail: true },
    },
    cp_address: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    cp_city_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'cities', // name of the City model
            key: 'id',
        },
    },
    cp_state_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'states', // name of the State model
            key: 'id',
        },
    },
    cp_pincode: {
        type: DataTypes.STRING(6),
        allowNull: false,
    },
    company_logo: {
        type: DataTypes.STRING(255),
        allowNull: true,
    }
}, {
    tableName: 'dealers',
    timestamps: true,
});

module.exports = Dealer;