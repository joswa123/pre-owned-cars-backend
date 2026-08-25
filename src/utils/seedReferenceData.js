const { CarType, FuelType, Transmission } = require('../models');
const sequelize = require('../config/database');
const logger = require('./logger');

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
    for (const typeName of BODY_TYPES) {
      const existing = await CarType.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          typeName.toLowerCase()
        ),
      });
      if (!existing) {
        await CarType.create({ name: typeName });
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

    logger.info('✅ Reference metadata (Body types, Fuel types, Transmissions) verified and seeded.');
  } catch (error) {
    logger.warn(`⚠️ Reference data seeding warning: ${error.message}`);
  }
}

module.exports = seedReferenceData;
