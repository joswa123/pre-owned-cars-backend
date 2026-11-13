'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM commercial_vehicles');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (!existingCols.has('price_negotiable')) {
      await queryInterface.addColumn('commercial_vehicles', 'price_negotiable', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!existingCols.has('video_url')) {
      await queryInterface.addColumn('commercial_vehicles', 'video_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!existingCols.has('audio_url')) {
      await queryInterface.addColumn('commercial_vehicles', 'audio_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface) => {
    const [columns] = await queryInterface.sequelize.query('SHOW COLUMNS FROM commercial_vehicles');
    const existingCols = new Set(columns.map((c) => c.Field));

    if (existingCols.has('audio_url')) {
      await queryInterface.removeColumn('commercial_vehicles', 'audio_url');
    }
    if (existingCols.has('video_url')) {
      await queryInterface.removeColumn('commercial_vehicles', 'video_url');
    }
    if (existingCols.has('price_negotiable')) {
      await queryInterface.removeColumn('commercial_vehicles', 'price_negotiable');
    }
  },
};

