'use strict';

const UUID_TYPE = 'CHAR(36) CHARACTER SET utf8 COLLATE utf8_bin';

module.exports = {
  up: async (queryInterface) => {
    const info = await queryInterface.describeTable('models');
    if (!info.category_id) {
      await queryInterface.addColumn('models', 'category_id', {
        type: UUID_TYPE,
        allowNull: true,
        references: {
          model: 'categories',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      try {
        await queryInterface.addIndex('models', ['category_id'], {
          name: 'idx_models_category_id',
        });
      } catch (e) {}
    }
  },

  down: async (queryInterface) => {
    try {
      await queryInterface.removeIndex('models', 'idx_models_category_id');
    } catch (e) {}
    const info = await queryInterface.describeTable('models');
    if (info.category_id) {
      await queryInterface.removeColumn('models', 'category_id');
    }
  },
};
