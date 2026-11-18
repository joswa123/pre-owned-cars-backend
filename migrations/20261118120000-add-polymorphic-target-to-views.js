'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('views');

    // 1. Add target_type ENUM('car','commercial') NOT NULL DEFAULT 'car'
    if (!tableInfo.target_type) {
      await queryInterface.addColumn('views', 'target_type', {
        type: Sequelize.ENUM('car', 'commercial'),
        allowNull: false,
        defaultValue: 'car',
      });
    }

    // 2. Add target_id CHAR(36) NULL initially so we can backfill
    if (!tableInfo.target_id) {
      await queryInterface.addColumn('views', 'target_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
    }

    // 3. Backfill target_id = car_id
    await queryInterface.sequelize.query(
      "UPDATE views SET target_id = car_id, target_type = 'car' WHERE target_id IS NULL OR target_type IS NULL"
    );

    // 4. Alter target_id to NOT NULL
    await queryInterface.changeColumn('views', 'target_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
    });

    // 5. Add indexes idempotently
    try {
      await queryInterface.addIndex('views', ['target_type', 'target_id', 'user_id'], {
        name: 'idx_views_target_user',
      });
    } catch (e) {
      // index already exists
    }

    try {
      await queryInterface.addIndex('views', ['target_type', 'target_id', 'timestamp'], {
        name: 'idx_views_target_timestamp',
      });
    } catch (e) {
      // index already exists
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('views', 'idx_views_target_user');
    } catch (e) {}

    try {
      await queryInterface.removeIndex('views', 'idx_views_target_timestamp');
    } catch (e) {}

    const tableInfo = await queryInterface.describeTable('views');
    if (tableInfo.target_id) {
      await queryInterface.removeColumn('views', 'target_id');
    }
    if (tableInfo.target_type) {
      await queryInterface.removeColumn('views', 'target_type');
    }
  },
};
