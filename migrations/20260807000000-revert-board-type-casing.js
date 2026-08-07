'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Temporarily change column to VARCHAR so we can change the strings without ENUM constraints
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type VARCHAR(50) NOT NULL DEFAULT 'OWN BOARD';
    `);

    // 2. Update existing Title Case and lowercase values to UPPERCASE
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'OWN BOARD' WHERE LOWER(board_type) IN ('own board', 'white');
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'T-BOARD' WHERE LOWER(board_type) IN ('t-board');
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'COMMERCIAL' WHERE LOWER(board_type) IN ('commercial');
    `);
    
    // Set any other invalid ones to OWN BOARD
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'OWN BOARD' WHERE board_type NOT IN ('OWN BOARD', 'T-BOARD', 'COMMERCIAL');
    `);

    // 3. Modify the column to be strictly the new UPPERCASE ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type ENUM('OWN BOARD', 'T-BOARD', 'COMMERCIAL') NOT NULL DEFAULT 'OWN BOARD';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert to VARCHAR
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type VARCHAR(50) NOT NULL DEFAULT 'Own Board';
    `);

    // Revert existing UPPERCASE values to Title Case
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'Own Board' WHERE board_type = 'OWN BOARD';
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'T-Board' WHERE board_type = 'T-BOARD';
    `);
    await queryInterface.sequelize.query(`
      UPDATE cars SET board_type = 'Commercial' WHERE board_type = 'COMMERCIAL';
    `);

    // Revert to old ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN board_type ENUM('Own Board', 'T-Board', 'Commercial') NOT NULL DEFAULT 'Own Board';
    `);
  }
};
