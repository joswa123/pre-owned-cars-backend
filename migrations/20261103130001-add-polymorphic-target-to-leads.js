'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('leads');

    // 1. Add target_type ENUM('car','commercial') NOT NULL DEFAULT 'car'
    if (!tableInfo.target_type) {
      await queryInterface.addColumn('leads', 'target_type', {
        type: Sequelize.ENUM('car', 'commercial'),
        allowNull: false,
        defaultValue: 'car',
      });
    }

    // 2. Add target_id CHAR(36) NULL initially so we can backfill
    if (!tableInfo.target_id) {
      await queryInterface.addColumn('leads', 'target_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
    }

    // 3. Backfill target_id = car_id
    await queryInterface.sequelize.query(
      "UPDATE leads SET target_id = car_id, target_type = 'car' WHERE target_id IS NULL OR target_type IS NULL"
    );

    // 4. Alter target_id to NOT NULL
    await queryInterface.changeColumn('leads', 'target_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
    });

    // 5. Add indexes idempotently
    try {
      await queryInterface.addIndex('leads', ['target_type', 'target_id'], {
        name: 'idx_leads_target',
      });
    } catch (e) {
      // index already exists
    }

    try {
      await queryInterface.addIndex('leads', ['buyer_id', 'created_at'], {
        name: 'idx_leads_user_created',
      });
    } catch (e) {
      // index already exists
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('leads', 'idx_leads_target');
    } catch (e) {}

    try {
      await queryInterface.removeIndex('leads', 'idx_leads_user_created');
    } catch (e) {}

    const tableInfo = await queryInterface.describeTable('leads');
    if (tableInfo.target_id) {
      await queryInterface.removeColumn('leads', 'target_id');
    }
    if (tableInfo.target_type) {
      await queryInterface.removeColumn('leads', 'target_type');
    }
  },
};

