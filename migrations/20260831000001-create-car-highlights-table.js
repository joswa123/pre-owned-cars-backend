'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('car_highlights', {
      car_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cars',
          key: 'id',
        },
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      highlight_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'highlights',
          key: 'id',
        },
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('car_highlights', ['car_id', 'highlight_id'], {
      unique: true,
      name: 'car_highlights_car_id_highlight_id_unique',
    });
    await queryInterface.addIndex('car_highlights', ['highlight_id', 'car_id'], {
      name: 'car_highlights_highlight_id_car_id_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('car_highlights');
  },
};
