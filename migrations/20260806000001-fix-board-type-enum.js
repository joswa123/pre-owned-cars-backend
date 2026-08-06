'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Update any existing invalid values like 'White' to 'OWN BOARD'
    await queryInterface.sequelize.query(`
      UPDATE cars 
      SET board_type = 'OWN BOARD' 
      WHERE board_type NOT IN ('OWN BOARD', 'T-BOARD', 'COMMERCIAL') OR board_type IS NULL;
    `);

    // 2. Modify the column to be strictly an ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type ENUM('OWN BOARD', 'T-BOARD', 'COMMERCIAL') NOT NULL DEFAULT 'OWN BOARD';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert back to VARCHAR
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type VARCHAR(50) NOT NULL DEFAULT 'White';
    `);
  }
};
