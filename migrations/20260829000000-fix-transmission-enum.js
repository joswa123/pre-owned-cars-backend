'use strict';

const TABLE = 'cars';
const COLUMN = 'transmission';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Temporarily modify column to VARCHAR(50) to allow backfilling safely without ENUM constraint violations
    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE}
      MODIFY COLUMN ${COLUMN} VARCHAR(50) NOT NULL DEFAULT 'Manual';
    `);

    // 2. Map old values to new ones
    await queryInterface.sequelize.query(`
      UPDATE ${TABLE}
      SET ${COLUMN} = CASE
        WHEN LOWER(${COLUMN}) IN ('amt', 'imt', 'clutchless-manual') THEN 'Clutchless Manual'
        WHEN LOWER(${COLUMN}) IN ('cvt', 'dct') THEN 'Automatic'
        WHEN LOWER(${COLUMN}) = 'automatic' THEN 'Automatic'
        WHEN LOWER(${COLUMN}) = 'clutchless manual' THEN 'Clutchless Manual'
        ELSE 'Manual'
      END
      WHERE ${COLUMN} NOT IN ('Manual', 'Automatic', 'Clutchless Manual') OR ${COLUMN} IS NULL;
    `);

    // 3. Alter column to strict ENUM with only the 3 allowed values
    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE}
      MODIFY COLUMN ${COLUMN} ENUM('Manual', 'Automatic', 'Clutchless Manual') NOT NULL DEFAULT 'Manual';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to VARCHAR first
    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE}
      MODIFY COLUMN ${COLUMN} VARCHAR(50) NOT NULL DEFAULT 'Manual';
    `);

    // Revert back to previous ENUM definition
    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE}
      MODIFY COLUMN ${COLUMN} ENUM('Manual', 'Automatic', 'Clutchless Manual', 'CVT', 'DCT') NOT NULL DEFAULT 'Manual';
    `);
  }
};
