'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'device_token', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'device_type', {
      type: Sequelize.ENUM('android', 'ios', 'web'),
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['device_token'], {
      name: 'idx_users_device_token'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'idx_users_device_token');
    await queryInterface.removeColumn('users', 'device_type');
    await queryInterface.removeColumn('users', 'device_token');
  }
};
