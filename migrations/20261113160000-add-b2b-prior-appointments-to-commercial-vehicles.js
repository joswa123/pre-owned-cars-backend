'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM commercial_vehicles');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (!existingCols.has('b2b_listing')) {
      await queryInterface.addColumn('commercial_vehicles', 'b2b_listing', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!existingCols.has('prior_appointments')) {
      await queryInterface.addColumn('commercial_vehicles', 'prior_appointments', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // Add indexes for efficient B2B filtering
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM commercial_vehicles');
    const existingIndexes = new Set(indexes.map((idx) => idx.Key_name));

    if (!existingIndexes.has('idx_commercial_vehicles_b2b')) {
      await queryInterface.addIndex('commercial_vehicles', ['b2b_listing'], {
        name: 'idx_commercial_vehicles_b2b',
      });
    }

    if (!existingIndexes.has('idx_commercial_vehicles_status_b2b')) {
      await queryInterface.addIndex('commercial_vehicles', ['status', 'b2b_listing'], {
        name: 'idx_commercial_vehicles_status_b2b',
      });
    }
  },

  down: async (queryInterface) => {
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM commercial_vehicles');
    const existingIndexes = new Set(indexes.map((idx) => idx.Key_name));

    if (existingIndexes.has('idx_commercial_vehicles_status_b2b')) {
      await queryInterface.removeIndex('commercial_vehicles', 'idx_commercial_vehicles_status_b2b');
    }
    if (existingIndexes.has('idx_commercial_vehicles_b2b')) {
      await queryInterface.removeIndex('commercial_vehicles', 'idx_commercial_vehicles_b2b');
    }

    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM commercial_vehicles');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (existingCols.has('prior_appointments')) {
      await queryInterface.removeColumn('commercial_vehicles', 'prior_appointments');
    }
    if (existingCols.has('b2b_listing')) {
      await queryInterface.removeColumn('commercial_vehicles', 'b2b_listing');
    }
  },
};

