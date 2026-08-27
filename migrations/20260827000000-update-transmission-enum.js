'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Temporarily modify transmission column to VARCHAR(50) so existing rows can be updated without ENUM constraint violations
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission VARCHAR(50) NOT NULL;
    `);

    // 2. Update existing rows where transmission was 'AMT' to 'Manual'
    await queryInterface.sequelize.query(`
      UPDATE cars 
      SET transmission = 'Manual' 
      WHERE LOWER(transmission) = 'amt';
    `);

    // 3. Update existing rows where transmission was 'IMT' to 'Clutchless Manual'
    await queryInterface.sequelize.query(`
      UPDATE cars 
      SET transmission = 'Clutchless Manual' 
      WHERE LOWER(transmission) = 'imt';
    `);

    // 4. Alter transmission column to strictly enforce the updated ENUM values (including 'Clutchless Manual' and excluding 'AMT')
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission ENUM('Manual', 'Automatic', 'Clutchless Manual', 'CVT', 'DCT') NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // 1. Temporarily modify transmission column to VARCHAR(50)
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission VARCHAR(50) NOT NULL;
    `);

    // 2. Revert any 'Clutchless Manual' back to 'AMT'
    await queryInterface.sequelize.query(`
      UPDATE cars 
      SET transmission = 'AMT' 
      WHERE LOWER(transmission) = 'clutchless manual';
    `);

    // 3. Alter transmission column back to previous ENUM definition
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission ENUM('Manual', 'Automatic', 'AMT', 'CVT', 'DCT') NOT NULL;
    `);
  }
};
