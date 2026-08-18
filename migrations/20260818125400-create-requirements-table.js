'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('requirements', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      brand_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'brands', key: 'id' },
        onDelete: 'RESTRICT',
      },
      model_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'models', key: 'id' },
        onDelete: 'RESTRICT',
      },
      min_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      min_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      max_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      min_km: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_km: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      body_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      transmission: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      board_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      purchase_plan_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'expired', 'bought', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
      },
      bought_from: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add indexes for optimized lookups
    await queryInterface.addIndex('requirements', ['user_id', 'status'], {
      name: 'requirements_user_id_status_idx'
    });
    await queryInterface.addIndex('requirements', ['brand_id'], {
      name: 'requirements_brand_id_idx'
    });
    await queryInterface.addIndex('requirements', ['expiry_date'], {
      name: 'requirements_expiry_date_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('requirements');
  }
};
