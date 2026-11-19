'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Inspect existing columns on 'requirements' table
    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM `requirements`');
    const existingCols = new Set(columns.map((c) => c.Field));

    // 2. Add target_type ENUM('car', 'commercial') NOT NULL DEFAULT 'car'
    if (!existingCols.has('target_type')) {
      await queryInterface.addColumn('requirements', 'target_type', {
        type: Sequelize.ENUM('car', 'commercial'),
        allowNull: false,
        defaultValue: 'car',
      });
    }

    // 3. Add vehicle_type_id UUID NULL REFERENCES car_types(id)
    if (!existingCols.has('vehicle_type_id')) {
      await queryInterface.addColumn('requirements', 'vehicle_type_id', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'car_types',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // 4. Modify car-specific columns to allow NULL for commercial requirements
    if (existingCols.has('model_id')) {
      try {
        await queryInterface.sequelize.query(
          'ALTER TABLE `requirements` MODIFY COLUMN `model_id` CHAR(36) CHARACTER SET utf8 COLLATE utf8_bin NULL DEFAULT NULL;'
        );
      } catch (e) {
        await queryInterface.changeColumn('requirements', 'model_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'models',
            key: 'id',
          },
          onDelete: 'RESTRICT',
        });
      }
    }

    if (existingCols.has('body_type')) {
      await queryInterface.changeColumn('requirements', 'body_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (existingCols.has('board_type')) {
      await queryInterface.changeColumn('requirements', 'board_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      });
    }

    // 5. Add indexes for high-performance polymorphic filtering and matching
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM `requirements`');
    const existingIndexNames = new Set(indexes.map((idx) => idx.Key_name));

    if (!existingIndexNames.has('idx_requirements_target_status_expiry')) {
      await queryInterface.addIndex('requirements', ['target_type', 'status', 'expiry_date'], {
        name: 'idx_requirements_target_status_expiry',
      });
    }

    if (!existingIndexNames.has('idx_requirements_target_brand_type')) {
      await queryInterface.addIndex('requirements', ['target_type', 'brand_id', 'vehicle_type_id'], {
        name: 'idx_requirements_target_brand_type',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM `requirements`');
    const existingIndexNames = new Set(indexes.map((idx) => idx.Key_name));

    if (existingIndexNames.has('idx_requirements_target_brand_type')) {
      await queryInterface.removeIndex('requirements', 'idx_requirements_target_brand_type');
    }

    if (existingIndexNames.has('idx_requirements_target_status_expiry')) {
      await queryInterface.removeIndex('requirements', 'idx_requirements_target_status_expiry');
    }

    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM `requirements`');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (existingCols.has('vehicle_type_id')) {
      await queryInterface.removeColumn('requirements', 'vehicle_type_id');
    }

    if (existingCols.has('target_type')) {
      await queryInterface.removeColumn('requirements', 'target_type');
    }
  },
};
