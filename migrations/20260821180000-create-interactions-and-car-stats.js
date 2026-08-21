'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create car_interactions table
    await queryInterface.createTable('car_interactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      car_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cars',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('view', 'call', 'whatsapp', 'message', 'enquiry', 'wishlist'),
        allowNull: false,
        defaultValue: 'view',
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Indexes on car_interactions
    try {
      await queryInterface.addIndex('car_interactions', ['car_id', 'type', 'created_at'], {
        name: 'idx_car_interactions_car_type_created',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('car_interactions', ['user_id', 'created_at'], {
        name: 'idx_car_interactions_user_created',
      });
    } catch (e) {}

    // 2. Create car_stats table
    await queryInterface.createTable('car_stats', {
      car_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: {
          model: 'cars',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      views_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      calls_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      whatsapp_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      messages_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      enquiries_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      wishlist_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // 3. Initialize car_stats for existing cars with views and enquiry counts
    try {
      await queryInterface.sequelize.query(`
        INSERT INTO car_stats (car_id, views_count, enquiries_count, wishlist_count, created_at, updated_at)
        SELECT 
          c.id AS car_id,
          (SELECT COUNT(*) FROM views v WHERE v.car_id = c.id) AS views_count,
          (SELECT COUNT(*) FROM leads l WHERE l.car_id = c.id) AS enquiries_count,
          (SELECT COUNT(*) FROM wishlists w WHERE w.car_id = c.id) AS wishlist_count,
          NOW(),
          NOW()
        FROM cars c
        ON DUPLICATE KEY UPDATE updated_at = NOW()
      `);
    } catch (err) {
      console.warn('Initial car_stats population warning:', err.message);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('car_stats');
    await queryInterface.dropTable('car_interactions');
  },
};
