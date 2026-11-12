'use strict';

module.exports = {
  up: async (queryInterface) => {
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM wishlists');
    const existingKeys = new Set(indexes.map((idx) => idx.Key_name));

    // 1. Add composite index on (target_type, target_id) for commercial wishlist counts and seller queries
    if (!existingKeys.has('idx_wishlists_target')) {
      await queryInterface.addIndex('wishlists', ['target_type', 'target_id'], {
        name: 'idx_wishlists_target',
      });
    }

    // 2. Safely drop redundant legacy unique index if unique_user_car_wishlist exists
    if (existingKeys.has('wishlists_user_id_car_id') && existingKeys.has('unique_user_car_wishlist')) {
      try {
        await queryInterface.removeIndex('wishlists', 'wishlists_user_id_car_id');
      } catch (err) {
        console.warn('Could not drop redundant index wishlists_user_id_car_id:', err.message);
      }
    }
  },

  down: async (queryInterface) => {
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM wishlists');
    const existingKeys = new Set(indexes.map((idx) => idx.Key_name));

    if (existingKeys.has('idx_wishlists_target')) {
      await queryInterface.removeIndex('wishlists', 'idx_wishlists_target');
    }

    if (!existingKeys.has('wishlists_user_id_car_id')) {
      try {
        await queryInterface.addIndex('wishlists', ['user_id', 'car_id'], {
          name: 'wishlists_user_id_car_id',
          unique: true,
        });
      } catch (err) {
        console.warn('Could not restore index wishlists_user_id_car_id:', err.message);
      }
    }
  },
};

