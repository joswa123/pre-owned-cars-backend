'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const addIndexSafe = async (table, fields, options) => {
      try {
        await queryInterface.addIndex(table, fields, options);
      } catch (err) {
        if (err.name === 'SequelizeDatabaseError' && (err.message.includes('Duplicate key name') || err.message.includes('already exists'))) {
          console.log(`Index ${options?.name || fields} already exists, skipping...`);
        } else if (err.message && err.message.includes('ER_DUP_KEYNAME')) {
          console.log(`Index ${options?.name || fields} already exists, skipping...`);
        } else {
          throw err;
        }
      }
    };

    // Composite index for dealer vs customer listings (status, posted_by_type, created_at DESC)
    await addIndexSafe('cars', [
      { name: 'status' },
      { name: 'posted_by_type' },
      { name: 'created_at', order: 'DESC' }
    ], {
      name: 'idx_cars_status_posted_created'
    });
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('cars', 'idx_cars_status_posted_created');
    } catch (err) {
      console.log('Failed to remove index idx_cars_status_posted_created:', err.message);
    }
  }
};
