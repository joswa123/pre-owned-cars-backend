const { User, State, City } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

exports.createCity = async (cityData) => {
    const { user_id, state_id, city_name, pin_code, status } = cityData;

    // Check if the user exists
    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    // Check if the state exists
    const state = await State.findByPk(state_id);
    if (!state) {
        throw new AppError('State not found.', 404);
    }

    const city = await City.findOne({ where: { city_name: city_name.trim().toLowerCase(), pin_code } });
    if (city) {
        throw new AppError('City already exists.', 400);
    }

    const newCity = await City.create({ user_id, state_id, city_name: city_name.trim().toLowerCase(), pin_code, status });
    
    return newCity;
};

exports.getCities = async () => {
    const cities = await City.findAll({
        include: [{
            model: User,
            attributes: ['id', 'full_name'] // Adjust attributes as needed
        },
        {
            model: State,
            attributes: ['id', 'state_name'] // Adjust attributes as needed
        }]
    });
    return cities;
}