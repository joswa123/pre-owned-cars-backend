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

    // For similar cars queries
    await addIndexSafe('cars', ['brand_id', 'model', 'body_type'], { name: 'idx_cars_brand_model_body' });
    
    // For price and year range filtering
    await addIndexSafe('cars', ['price', 'year'], { name: 'idx_cars_price_year' });
    
    // For seller's cars query
    await addIndexSafe('cars', ['user_id', 'status'], { name: 'idx_cars_user_status' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('cars', 'idx_cars_brand_model_body');
    await queryInterface.removeIndex('cars', 'idx_cars_price_year');
    await queryInterface.removeIndex('cars', 'idx_cars_user_status');
  }
};
