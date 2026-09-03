'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add order column if it does not already exist
    const table = await queryInterface.describeTable('car_types');
    if (!table.order) {
      await queryInterface.addColumn('car_types', 'order', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 999,
      });
    }

    // 2. Set priority order for key body types (case-insensitive)
    await queryInterface.sequelize.query(`
      UPDATE car_types
      SET \`order\` = CASE
        WHEN LOWER(name) = 'hatchback' THEN 1
        WHEN LOWER(name) = 'sedan' THEN 2
        WHEN LOWER(name) = 'suv' THEN 3
        WHEN LOWER(name) = 'muv' THEN 4
        ELSE 999
      END;
    `);
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('car_types');
    if (table.order) {
      await queryInterface.removeColumn('car_types', 'order');
    }
  }
};
