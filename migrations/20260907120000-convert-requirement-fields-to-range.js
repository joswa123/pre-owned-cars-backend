'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('requirements', 'min_price', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });

    await queryInterface.addColumn('requirements', 'max_price', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });

    await queryInterface.addColumn('requirements', 'min_km', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('requirements', 'max_km', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('requirements', 'min_price');
    await queryInterface.removeColumn('requirements', 'max_price');
    await queryInterface.removeColumn('requirements', 'min_km');
    await queryInterface.removeColumn('requirements', 'max_km');
  },
};
