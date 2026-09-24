'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. cars.transmission: ensure VARCHAR(100) NULL
    await queryInterface.sequelize.query(`
      ALTER TABLE \`cars\` MODIFY COLUMN \`transmission\` VARCHAR(100) NULL DEFAULT 'Manual';
    `);

    // 2. variants.transmission: ENUM → VARCHAR(100) NULL
    await queryInterface.sequelize.query(`
      ALTER TABLE \`variants\` MODIFY COLUMN \`transmission\` VARCHAR(100) NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.changeColumn('variants', 'transmission', {
        type: Sequelize.ENUM('Manual', 'Automatic', 'AMT', 'CVT', 'DCT'),
        allowNull: true,
      });
    } catch (e) {
      console.warn('Revert variants.transmission failed:', e.message);
    }
  }
};
