'use strict';

const UUID_TYPE = 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create table commercial_vehicles
    await queryInterface.createTable('commercial_vehicles', {
      id: {
        type: UUID_TYPE,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: UUID_TYPE,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      vehicle_type_id: {
        type: UUID_TYPE,
        allowNull: false,
        references: {
          model: 'car_types',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      brand_id: {
        type: UUID_TYPE,
        allowNull: false,
        references: {
          model: 'brands',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fuel_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Diesel',
      },
      ownership: {
        type: Sequelize.ENUM('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'),
        allowNull: false,
      },
      km_driven: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      state_id: {
        type: UUID_TYPE,
        allowNull: true,
        references: {
          model: 'states',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      district_id: {
        type: UUID_TYPE,
        allowNull: true,
        references: {
          model: 'districts',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      city_id: {
        type: UUID_TYPE,
        allowNull: true,
        references: {
          model: 'cities',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      posted_by_type: {
        type: Sequelize.ENUM('customer', 'dealer'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('sold', 'active', 'deleted', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      views_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      featured_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      approved_by: {
        type: UUID_TYPE,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci',
    });

    // 2. Add required composite and query indexes
    await queryInterface.addIndex('commercial_vehicles', ['vehicle_type_id', 'status', 'created_at'], {
      name: 'idx_cv_vehicle_type_status_created',
    });

    await queryInterface.addIndex('commercial_vehicles', ['brand_id', 'status', 'price'], {
      name: 'idx_cv_brand_status_price',
    });

    await queryInterface.addIndex('commercial_vehicles', ['city_id', 'status'], {
      name: 'idx_cv_city_status',
    });

    await queryInterface.addIndex('commercial_vehicles', ['user_id', 'status'], {
      name: 'idx_cv_user_status',
    });

    await queryInterface.addIndex('commercial_vehicles', ['status', 'created_at'], {
      name: 'idx_cv_status_created',
    });

    await queryInterface.addIndex('commercial_vehicles', ['state_id'], {
      name: 'idx_cv_state_id',
    });

    await queryInterface.addIndex('commercial_vehicles', ['district_id'], {
      name: 'idx_cv_district_id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('commercial_vehicles');
  },
};
