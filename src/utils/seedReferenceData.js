const { CarType, FuelType, Transmission } = require('../models');
const sequelize = require('../config/database');
const logger = require('./logger');
const updateCarTypeIcons = require('../../scripts/update-car-type-icons');

const BODY_TYPES = [
  'Sedan',
  'Hatchback',
  'SUV',
  'MUV',
  'Estate',
  'Crossover',
  'Coupe',
  'Convertible',
  'Pickup',
  'Van Minivan',
  'Wagon',
  'Sports Car',
  'Notchback',
  'Sports sedan',
  'Others',
];

const FUEL_TYPES = [
  'Petrol',
  'Diesel',
  'Electric',
  'CNG',
  'LPG',
  'Hybrid',
];

const TRANSMISSIONS = [
  'Manual',
  'Automatic',
  'AMT',
  'IMT',
];

/**
 * Idempotently seeds reference data tables for Car Types (Body Types), Fuel Types, and Transmissions
 */
async function seedReferenceData() {
  try {
    // 1. Seed Body Types (CarType)
    const BODY_TYPE_ORDERS = {
      hatchback: 1,
      sedan: 2,
      suv: 3,
      muv: 4,
    };

    for (const typeName of BODY_TYPES) {
      const existing = await CarType.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          typeName.toLowerCase()
        ),
      });
      const order = BODY_TYPE_ORDERS[typeName.toLowerCase()] || 999;
      if (!existing) {
        await CarType.create({ name: typeName, order });
      } else if (existing.order !== order && BODY_TYPE_ORDERS[typeName.toLowerCase()]) {
        await existing.update({ order });
      }
    }

    // 2. Seed Fuel Types (FuelType)
    for (const fuelName of FUEL_TYPES) {
      const existing = await FuelType.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('fuel_type_name')),
          fuelName.toLowerCase()
        ),
      });
      if (!existing) {
        await FuelType.create({
          fuel_type_name: fuelName,
          status: 'active',
          user_id: null,
        });
      }
    }

    // 3. Seed Transmissions (Transmission)
    for (const transName of TRANSMISSIONS) {
      const existing = await Transmission.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('transmission_name')),
          transName.toLowerCase()
        ),
      });
      if (!existing) {
        await Transmission.create({
          transmission_name: transName,
          status: 'active',
          user_id: null,
        });
      }
    }

    // 4. Update and sync CarType Icons
    await updateCarTypeIcons();

    logger.info('✅ Reference metadata (Body types, Fuel types, Transmissions) verified and seeded.');
  } catch (error) {
    logger.warn(`⚠️ Reference data seeding warning: ${error.message}`);
  }
}

module.exports = seedReferenceData;
