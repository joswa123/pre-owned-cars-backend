'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('wishlists');

    // 1. Add target_type ENUM('car','commercial') NOT NULL DEFAULT 'car'
    if (!tableInfo.target_type) {
      await queryInterface.addColumn('wishlists', 'target_type', {
        type: Sequelize.ENUM('car', 'commercial'),
        allowNull: false,
        defaultValue: 'car',
      });
    }

    // 2. Add target_id CHAR(36) NULL initially
    if (!tableInfo.target_id) {
      await queryInterface.addColumn('wishlists', 'target_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
    }

    // 3. Backfill target_id = car_id
    await queryInterface.sequelize.query(
      "UPDATE wishlists SET target_id = car_id, target_type = 'car' WHERE target_id IS NULL OR target_type IS NULL"
    );

    // 4. Alter target_id to NOT NULL
    await queryInterface.changeColumn('wishlists', 'target_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
    });

    // 5. Add unique index uq_wishlists_user_target (user_id, target_type, target_id)
    try {
      await queryInterface.addIndex('wishlists', ['user_id', 'target_type', 'target_id'], {
        name: 'uq_wishlists_user_target',
        unique: true,
      });
    } catch (e) {
      // unique index already exists
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('wishlists', 'uq_wishlists_user_target');
    } catch (e) {}

    const tableInfo = await queryInterface.describeTable('wishlists');
    if (tableInfo.target_id) {
      await queryInterface.removeColumn('wishlists', 'target_id');
    }
    if (tableInfo.target_type) {
      await queryInterface.removeColumn('wishlists', 'target_type');
    }
  },
};

