const { User, State } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

exports.createState = async (stateData) => {
    const { user_id, state_name, state_code, status } = stateData;

    // Check if the user exists
    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const state = await State.findOne({ where: { state_name: state_name.trim().toLowerCase(), state_code: state_code.trim().toLowerCase() } });
    if (state) {
        throw new AppError('State already exists.', 400);
    }

    const newState = await State.create({ user_id, state_name: state_name.trim().toLowerCase(), state_code: state_code.trim().toLowerCase(), status });
    
    return newState;
};

exports.getStates = async () => {
    const states = await State.findAll({
        include: [{
            model: User,
            attributes: ['id', 'full_name'] // Adjust attributes as needed
        }]
    });
    return states;
}