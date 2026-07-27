const { State, City } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database'); 
// Get all states
exports.getStates = async () => {
  return await State.findAll({ order: [['name', 'ASC']] });
};

// ✅ Get cities by state ID
exports.getCitiesByState = async (stateId) => {
  // Verify the state exists
  const state = await State.findByPk(stateId);
  if (!state) throw new AppError('State not found.', 404);

  // Return cities for that state
  return await City.findAll({
    where: { state_id: stateId },
    order: [['name', 'ASC']],
  });
};

// Get all cities with state info
exports.getAllCities = async () => {
  return await City.findAll({
    include: [{ model: State, attributes: ['id', 'name', 'code'] }],
    order: [['name', 'ASC']],
  });
};