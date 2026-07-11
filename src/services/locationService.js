const { State, City } = require('../models');

exports.getStates = async () => {
  return await State.findAll({
    order: [['name', 'ASC']],
  });
};

exports.getCitiesByState = async (stateId) => {
  return await City.findAll({
    where: { state_id: stateId },
    order: [['name', 'ASC']],
  });
};

exports.getAllCities = async () => {
  return await City.findAll({
    include: [{ model: State, attributes: ['id', 'name', 'code'] }],
    order: [['name', 'ASC']],
  });
};