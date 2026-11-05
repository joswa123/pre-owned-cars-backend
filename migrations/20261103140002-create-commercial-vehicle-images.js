'use strict';

const UUID_TYPE = 'CHAR(36) CHARACTER SET utf8 COLLATE utf8_bin';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('commercial_vehicle_images', {
      id: {
        type: UUID_TYPE,
        primaryKey: true,
        allowNull: false,
      },
      commercial_vehicle_id: {
        type: UUID_TYPE,
        allowNull: false,
        references: {
          model: 'commercial_vehicles',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      public_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci',
    });

    // Indexes
    await queryInterface.addIndex('commercial_vehicle_images', ['commercial_vehicle_id'], {
      name: 'idx_cvi_vehicle_id',
    });

    await queryInterface.addIndex('commercial_vehicle_images', ['commercial_vehicle_id', 'sort_order'], {
      name: 'idx_cvi_vehicle_sort',
    });

    // Enforce exactly one primary per vehicle using a virtual generated column + unique index
    await queryInterface.sequelize.query(`
      ALTER TABLE commercial_vehicle_images 
      ADD COLUMN primary_vehicle_id CHAR(36) 
      GENERATED ALWAYS AS (IF(is_primary = 1, commercial_vehicle_id, NULL)) VIRTUAL
    `);

    await queryInterface.addIndex('commercial_vehicle_images', ['primary_vehicle_id'], {
      name: 'uq_cv_primary_image',
      unique: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('commercial_vehicle_images');
  },
};
