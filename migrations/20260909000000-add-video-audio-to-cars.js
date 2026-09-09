'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('cars', 'video_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Cloudinary URL for car video',
    });
    await queryInterface.addColumn('cars', 'audio_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Cloudinary URL for car audio (e.g., engine sound)',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('cars', 'video_url');
    await queryInterface.removeColumn('cars', 'audio_url');
  },
};
