'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('requirements', 'transmission', {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('requirements', 'transmission', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'Manual',
    });
  }
};
