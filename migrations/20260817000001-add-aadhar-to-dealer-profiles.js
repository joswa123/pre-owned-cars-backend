'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('dealer_profiles', 'aadhar_no', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('dealer_profiles', 'aadhar_no');
  }
};
