'use strict';

const UUID_TYPE = 'CHAR(36) CHARACTER SET utf8 COLLATE utf8_bin';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bike_images', {
      id: {
        type: UUID_TYPE,
        primaryKey: true,
        allowNull: false,
      },
      bike_id: {
        type: UUID_TYPE,
        allowNull: false,
        references: {
          model: 'bikes',
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

    await queryInterface.addIndex('bike_images', ['bike_id'], {
      name: 'idx_bike_images_bike_id',
    });
    await queryInterface.addIndex('bike_images', ['bike_id', 'sort_order'], {
      name: 'idx_bike_images_bike_sort',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bike_images');
  },
};
