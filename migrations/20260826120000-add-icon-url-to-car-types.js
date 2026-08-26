'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('car_types');
    if (!tableDescription.icon_url) {
      await queryInterface.addColumn('car_types', 'icon_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const tableDescription = await queryInterface.describeTable('car_types');
    if (tableDescription.icon_url) {
      await queryInterface.removeColumn('car_types', 'icon_url');
    }
  },
};
