'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add image_url column to models table
    await queryInterface.addColumn('models', 'image_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('models', 'image_url');
  },
};
