'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Alter fuel_type ENUM to include extended hybrid and fuel types
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN fuel_type ENUM(
        'Petrol', 'Diesel', 'CNG', 'Electric',
        'Hybrid',
        'Hybrid (Electric + Petrol)',
        'Mild Hybrid(Electric + Petrol)',
        'Mild Hybrid (Electric + Diesel)',
        'Plug-in Hybrid (Electric + Petrol)',
        'LPG'
      ) NOT NULL DEFAULT 'Petrol';
    `);

    // 2. Alter transmission column to VARCHAR(100) to support all transmission designations
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission VARCHAR(100) NOT NULL DEFAULT 'Manual';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN fuel_type ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG') NOT NULL DEFAULT 'Petrol';
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission VARCHAR(50) NOT NULL DEFAULT 'Manual';
    `);
  }
};
