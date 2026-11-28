'use strict';

const UUID_TYPE = 'CHAR(36) CHARACTER SET utf8 COLLATE utf8_bin';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bikes', {
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
        allowNull: true,
        references: {
          model: 'car_types',
          key: 'id',
        },
        onDelete: 'SET NULL',
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
      model_id: {
        type: UUID_TYPE,
        allowNull: false,
        references: {
          model: 'models',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fuel_type: {
        type: Sequelize.ENUM('Petrol', 'Electric', 'CNG', 'Hybrid', 'Others'),
        allowNull: false,
        defaultValue: 'Petrol',
      },
      ownership: {
        type: Sequelize.ENUM('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'),
        allowNull: false,
        defaultValue: '1st Owner',
      },
      km_driven: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      price_negotiable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      video_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      audio_url: {
        type: Sequelize.STRING(500),
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
        defaultValue: 'customer',
      },
      b2b_listing: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      prior_appointments: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      insurance_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'Not Insured',
      },
      insurance_expiry_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
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

    await queryInterface.addIndex('bikes', ['brand_id', 'model_id', 'status'], {
      name: 'idx_bikes_brand_model_status',
    });
    await queryInterface.addIndex('bikes', ['brand_id', 'status', 'price'], {
      name: 'idx_bikes_brand_status_price',
    });
    await queryInterface.addIndex('bikes', ['city_id', 'status'], {
      name: 'idx_bikes_city_status',
    });
    await queryInterface.addIndex('bikes', ['user_id', 'status'], {
      name: 'idx_bikes_user_status',
    });
    await queryInterface.addIndex('bikes', ['status', 'created_at'], {
      name: 'idx_bikes_status_created',
    });
    await queryInterface.addIndex('bikes', ['state_id'], {
      name: 'idx_bikes_state_id',
    });
    await queryInterface.addIndex('bikes', ['district_id'], {
      name: 'idx_bikes_district_id',
    });
    await queryInterface.addIndex('bikes', ['fuel_type', 'status'], {
      name: 'idx_bikes_fuel_status',
    });
    await queryInterface.addIndex('bikes', ['status', 'b2b_listing'], {
      name: 'idx_bikes_status_b2b',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bikes');
  },
};
