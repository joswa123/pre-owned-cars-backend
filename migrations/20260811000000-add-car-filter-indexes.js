'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const addIndexSafe = async (table, fields, options) => {
      try {
        await queryInterface.addIndex(table, fields, options);
      } catch (err) {
        if (err.name === 'SequelizeDatabaseError' && err.message.includes('Duplicate key name')) {
          console.log(`Index on ${fields.join(', ')} already exists, skipping...`);
        } else if (err.message && err.message.includes('ER_DUP_KEYNAME')) {
          console.log(`Index on ${fields.join(', ')} already exists, skipping...`);
        } else {
          throw err;
        }
      }
    };

    // Single column indexes
    await addIndexSafe('cars', ['year']);
    await addIndexSafe('cars', ['km_driven']);
    await addIndexSafe('cars', ['fuel_type']);
    await addIndexSafe('cars', ['body_type']);
    await addIndexSafe('cars', ['ownership']);
    await addIndexSafe('cars', ['transmission']);
    await addIndexSafe('cars', ['created_at']);
    
    // Composite indexes for common query patterns
    await addIndexSafe('cars', ['status', 'created_at']);
    await addIndexSafe('cars', ['status', 'brand_id', 'model']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the indexes
    await queryInterface.removeIndex('cars', ['year']);
    await queryInterface.removeIndex('cars', ['km_driven']);
    await queryInterface.removeIndex('cars', ['fuel_type']);
    await queryInterface.removeIndex('cars', ['body_type']);
    await queryInterface.removeIndex('cars', ['ownership']);
    await queryInterface.removeIndex('cars', ['transmission']);
    await queryInterface.removeIndex('cars', ['created_at']);
    
    await queryInterface.removeIndex('cars', ['status', 'created_at']);
    await queryInterface.removeIndex('cars', ['status', 'brand_id', 'model']);
  }
};
