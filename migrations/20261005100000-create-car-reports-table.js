'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('car_reports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      car_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cars', key: 'id' },
        onDelete: 'CASCADE',
      },
      dealer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      reporter_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      reporter_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      reporter_phone: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_review', 'resolved', 'dismissed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      admin_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resolved_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('car_reports', ['status', 'created_at'], {
      name: 'car_reports_status_created_at_idx',
    });
    await queryInterface.addIndex('car_reports', ['car_id'], {
      name: 'car_reports_car_id_idx',
    });
    await queryInterface.addIndex('car_reports', ['dealer_id'], {
      name: 'car_reports_dealer_id_idx',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('car_reports');
  },
};
