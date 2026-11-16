'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM commercial_vehicles');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (!existingCols.has('board_type')) {
      await queryInterface.addColumn('commercial_vehicles', 'board_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'Commercial',
      });
    }

    if (!existingCols.has('insurance_type')) {
      await queryInterface.addColumn('commercial_vehicles', 'insurance_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'Not Insured',
      });
    }

    if (!existingCols.has('insurance_expiry_date')) {
      await queryInterface.addColumn('commercial_vehicles', 'insurance_expiry_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      });
    }

    // Add indexes for efficient filtering
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM commercial_vehicles');
    const existingIndexes = new Set(indexes.map((idx) => idx.Key_name));

    if (!existingIndexes.has('idx_commercial_vehicles_board_type')) {
      await queryInterface.addIndex('commercial_vehicles', ['board_type'], {
        name: 'idx_commercial_vehicles_board_type',
      });
    }

    if (!existingIndexes.has('idx_commercial_vehicles_status_board_type')) {
      await queryInterface.addIndex('commercial_vehicles', ['status', 'board_type'], {
        name: 'idx_commercial_vehicles_status_board_type',
      });
    }
  },

  down: async (queryInterface) => {
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM commercial_vehicles');
    const existingIndexes = new Set(indexes.map((idx) => idx.Key_name));

    if (existingIndexes.has('idx_commercial_vehicles_status_board_type')) {
      await queryInterface.removeIndex('commercial_vehicles', 'idx_commercial_vehicles_status_board_type');
    }
    if (existingIndexes.has('idx_commercial_vehicles_board_type')) {
      await queryInterface.removeIndex('commercial_vehicles', 'idx_commercial_vehicles_board_type');
    }

    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM commercial_vehicles');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (existingCols.has('insurance_expiry_date')) {
      await queryInterface.removeColumn('commercial_vehicles', 'insurance_expiry_date');
    }
    if (existingCols.has('insurance_type')) {
      await queryInterface.removeColumn('commercial_vehicles', 'insurance_type');
    }
    if (existingCols.has('board_type')) {
      await queryInterface.removeColumn('commercial_vehicles', 'board_type');
    }
  },
};

