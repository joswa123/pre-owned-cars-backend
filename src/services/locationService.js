const { State, District, City } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');

// Get all states
exports.getStates = async () => {
  return await State.findAll({ order: [['name', 'ASC']] });
};

// Get districts by state ID
exports.getDistrictsByState = async (stateId) => {
  const state = await State.findByPk(stateId);
  if (!state) throw new AppError('State not found.', 404);

  return await District.findAll({
    where: { state_id: stateId },
    order: [['name', 'ASC']],
  });
};

// Get cities by district ID
exports.getCitiesByDistrict = async (districtId) => {
  const district = await District.findByPk(districtId);
  if (!district) throw new AppError('District not found.', 404);

  return await City.findAll({
    where: { district_id: districtId },
    order: [['name', 'ASC']],
  });
};

// Get cities by state ID
exports.getCitiesByState = async (stateId) => {
  const state = await State.findByPk(stateId);
  if (!state) throw new AppError('State not found.', 404);

  return await City.findAll({
    where: { state_id: stateId },
    order: [['name', 'ASC']],
  });
};

// Get all cities with state and district info
exports.getAllCities = async () => {
  return await City.findAll({
    include: [
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
    ],
    order: [['name', 'ASC']],
  });
};