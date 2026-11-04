'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('car_reports');

    // 1. Add target_type ENUM('car','commercial') NOT NULL DEFAULT 'car'
    if (!tableInfo.target_type) {
      await queryInterface.addColumn('car_reports', 'target_type', {
        type: Sequelize.ENUM('car', 'commercial'),
        allowNull: false,
        defaultValue: 'car',
      });
    }

    // 2. Add target_id CHAR(36) NULL initially for backfill
    if (!tableInfo.target_id) {
      await queryInterface.addColumn('car_reports', 'target_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
    }

    // 3. Backfill target_id = car_id
    await queryInterface.sequelize.query(
      "UPDATE car_reports SET target_id = car_id, target_type = 'car' WHERE target_id IS NULL OR target_type IS NULL"
    );

    // 4. Alter target_id to NOT NULL
    await queryInterface.changeColumn('car_reports', 'target_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
    });

    // 5. Add index idx_reports_target (target_type, target_id, status)
    try {
      await queryInterface.addIndex('car_reports', ['target_type', 'target_id', 'status'], {
        name: 'idx_reports_target',
      });
    } catch (e) {
      // index already exists
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('car_reports', 'idx_reports_target');
    } catch (e) {}

    const tableInfo = await queryInterface.describeTable('car_reports');
    if (tableInfo.target_id) {
      await queryInterface.removeColumn('car_reports', 'target_id');
    }
    if (tableInfo.target_type) {
      await queryInterface.removeColumn('car_reports', 'target_type');
    }
  },
};

