'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check and drop price column if exists
    const tableInfo = await queryInterface.describeTable('requirements');

    if (tableInfo.price) {
      await queryInterface.removeColumn('requirements', 'price');
    }

    if (tableInfo.km_driven) {
      await queryInterface.removeColumn('requirements', 'km_driven');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('requirements', 'price', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });

    await queryInterface.addColumn('requirements', 'km_driven', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
