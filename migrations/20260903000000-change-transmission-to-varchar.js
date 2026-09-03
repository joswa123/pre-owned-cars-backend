'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission VARCHAR(50) NOT NULL DEFAULT 'Manual';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission ENUM('Manual', 'Automatic', 'Clutchless Manual') NOT NULL DEFAULT 'Manual';
    `);
  }
};
