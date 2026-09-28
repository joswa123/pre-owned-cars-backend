'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Alter fuel_type in cars table from ENUM to VARCHAR(100) to accept any string from external APIs
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN fuel_type VARCHAR(100) NOT NULL DEFAULT 'Petrol';
    `);

    // 2. Ensure transmission in cars table is VARCHAR(100)
    await queryInterface.sequelize.query(`
      ALTER TABLE cars 
      MODIFY COLUMN transmission VARCHAR(100) NULL DEFAULT 'Manual';
    `);

    // 3. Alter fuel_type and transmission in variants table to VARCHAR(100)
    await queryInterface.sequelize.query(`
      ALTER TABLE variants 
      MODIFY COLUMN fuel_type VARCHAR(100) NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE variants 
      MODIFY COLUMN transmission VARCHAR(100) NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
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
  },
};
