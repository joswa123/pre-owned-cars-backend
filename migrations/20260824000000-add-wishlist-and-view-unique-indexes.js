'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Deduplicate wishlists table if any duplicates exist
    try {
      await queryInterface.sequelize.query(`
        DELETE w1 FROM wishlists w1
        INNER JOIN wishlists w2 
        WHERE w1.id < w2.id 
          AND w1.user_id = w2.user_id 
          AND w1.car_id = w2.car_id;
      `);
    } catch (e) {
      console.warn('Wishlist deduplication note:', e.message);
    }

    // 2. Add unique index to wishlists(user_id, car_id)
    try {
      await queryInterface.addIndex('wishlists', ['user_id', 'car_id'], {
        unique: true,
        name: 'unique_user_car_wishlist',
      });
    } catch (e) {
      console.warn('Wishlist unique index note:', e.message);
    }

    // 3. Deduplicate views table if duplicate user views exist
    try {
      await queryInterface.sequelize.query(`
        DELETE v1 FROM views v1
        INNER JOIN views v2 
        WHERE v1.id < v2.id 
          AND v1.user_id IS NOT NULL 
          AND v1.car_id = v2.car_id 
          AND v1.user_id = v2.user_id;
      `);
    } catch (e) {
      console.warn('Views deduplication note:', e.message);
    }

    // 4. Add unique index to views(car_id, user_id)
    try {
      await queryInterface.addIndex('views', ['car_id', 'user_id'], {
        unique: true,
        name: 'unique_car_user_view',
      });
    } catch (e) {
      console.warn('Views unique index note:', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('wishlists', 'unique_user_car_wishlist');
    } catch (e) {}

    try {
      await queryInterface.removeIndex('views', 'unique_car_user_view');
    } catch (e) {}
  },
};
