'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        CREATE INDEX idx_cars_brand_id ON cars(brand_id);
      `);
    } catch (e) {
      // Ignore if index already exists
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
    }
    
    try {
      await queryInterface.sequelize.query(`
        CREATE INDEX idx_cars_status_brand_id ON cars(status, brand_id);
      `);
    } catch (e) {
      // Ignore if index already exists
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(`
        DROP INDEX idx_cars_brand_id ON cars;
      `);
    } catch(e) {}
    
    try {
      await queryInterface.sequelize.query(`
        DROP INDEX idx_cars_status_brand_id ON cars;
      `);
    } catch(e) {}
  }
};
