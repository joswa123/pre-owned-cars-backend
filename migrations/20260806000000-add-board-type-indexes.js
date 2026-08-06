'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_cars_status_board_type ON cars(status, board_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_cars_status_b2b ON cars(status, b2b_listing);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX idx_cars_status_board_type ON cars;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX idx_cars_status_b2b ON cars;
    `);
  }
};
