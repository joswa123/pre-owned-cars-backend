'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add public_id column if not exists
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'car_images' 
        AND COLUMN_NAME = 'public_id';
    `);

    if (columns.length === 0) {
      await queryInterface.addColumn('car_images', 'public_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'is_primary',
        comment: 'Cloudinary public_id for image management and deletion',
      });
    }

    // 2. Expand image_url length to VARCHAR(500) and allow NULL for lost images
    await queryInterface.changeColumn('car_images', 'image_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Cloudinary secure_url for car image',
    });
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('car_images', 'public_id');
    } catch (e) {}

    await queryInterface.changeColumn('car_images', 'image_url', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
