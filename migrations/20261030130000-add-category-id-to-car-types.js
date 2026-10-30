'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('car_types');

    if (!tableInfo.category_id) {
      await queryInterface.addColumn('car_types', 'category_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: {
          model: 'categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });

      await queryInterface.addIndex('car_types', ['category_id'], {
        name: 'idx_car_types_category_id',
      });
    }

    // Safely backfill existing car_types with 'car' category ID to ensure zero data loss
    try {
      const [categories] = await queryInterface.sequelize.query(
        "SELECT id FROM categories WHERE slug = 'car' LIMIT 1"
      );
      if (categories && categories.length > 0) {
        const carCategoryId = categories[0].id;
        await queryInterface.sequelize.query(
          `UPDATE car_types SET category_id = '${carCategoryId}' WHERE category_id IS NULL`
        );
      }
    } catch (err) {
      console.warn('Notice: categories table not populated yet or skipped backfill:', err.message);
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('car_types');
    if (tableInfo.category_id) {
      try {
        await queryInterface.removeIndex('car_types', 'idx_car_types_category_id');
      } catch (e) {}
      await queryInterface.removeColumn('car_types', 'category_id');
    }
  },
};
