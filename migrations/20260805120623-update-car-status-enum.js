'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN status ENUM('sold', 'active', 'deleted', 'expired') NOT NULL DEFAULT 'active';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN status ENUM('sold', 'active') NOT NULL DEFAULT 'active';
    `);
  }
};
