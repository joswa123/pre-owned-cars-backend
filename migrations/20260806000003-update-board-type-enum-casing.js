'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Temporarily change column to VARCHAR so we can change the strings without ENUM constraints
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type VARCHAR(50) NOT NULL DEFAULT 'Own Board';
    `);

    // 2. Update existing all-caps values to Title Case
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'Own Board' WHERE board_type = 'OWN BOARD';
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'T-Board' WHERE board_type = 'T-BOARD';
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'Commercial' WHERE board_type = 'COMMERCIAL';
    `);

    // 3. Modify the column to be strictly the new Title Case ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type ENUM('Own Board', 'T-Board', 'Commercial') NOT NULL DEFAULT 'Own Board';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert to VARCHAR
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type VARCHAR(50) NOT NULL DEFAULT 'OWN BOARD';
    `);

    // Revert existing Title Case values to all-caps
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'OWN BOARD' WHERE board_type = 'Own Board';
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'T-BOARD' WHERE board_type = 'T-Board';
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'COMMERCIAL' WHERE board_type = 'Commercial';
    `);

    // Revert to old ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type ENUM('OWN BOARD', 'T-BOARD', 'COMMERCIAL') NOT NULL DEFAULT 'OWN BOARD';
    `);
  }
};
