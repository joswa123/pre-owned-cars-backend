'use strict';

const TABLES = ['leads', 'wishlists', 'requirements', 'views', 'car_reports', 'notifications'];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const info = await queryInterface.describeTable(table);
      if (info.target_type) {
        await queryInterface.changeColumn(table, 'target_type', {
          type: Sequelize.ENUM('car', 'commercial', 'bike'),
          allowNull: false,
          defaultValue: 'car',
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const info = await queryInterface.describeTable(table);
      if (info.target_type) {
        // Delete any bike records before shrinking enum to prevent truncation failure
        await queryInterface.sequelize.query(
          `DELETE FROM \`${table}\` WHERE target_type = 'bike'`
        );
        await queryInterface.changeColumn(table, 'target_type', {
          type: Sequelize.ENUM('car', 'commercial'),
          allowNull: false,
          defaultValue: 'car',
        });
      }
    }
  },
};
