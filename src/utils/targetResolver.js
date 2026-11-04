const { Car, CommercialVehicle } = require('../models');

/**
 * Resolves an entity by targetType and targetId.
 * - targetType === 'car' -> returns Car.findByPk(targetId, options)
 * - targetType === 'commercial' -> returns CommercialVehicle.findByPk(targetId, options)
 * - unknown targetType -> returns null
 *
 * @param {'car'|'commercial'|string} targetType
 * @param {string} targetId
 * @param {object} [options] - optional Sequelize find options (attributes, include, etc.)
 * @returns {Promise<object|null>}
 */
async function resolveTarget(targetType, targetId, options = {}) {
  if (!targetType || !targetId) {
    return null;
  }

  const type = String(targetType).toLowerCase();
  if (type === 'car') {
    return await Car.findByPk(targetId, options);
  }

  if (type === 'commercial') {
    return await CommercialVehicle.findByPk(targetId, options);
  }

  return null;
}

module.exports = {
  resolveTarget,
};
