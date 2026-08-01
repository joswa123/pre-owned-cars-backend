'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    // 1. Create customer_profiles table
    if (!tables.includes('customer_profiles')) {
      await queryInterface.createTable('customer_profiles', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          unique: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        preferences: {
          type: Sequelize.TEXT,
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
      });
    }

    // 2. Create dealer_profiles table
    if (!tables.includes('dealer_profiles')) {
      await queryInterface.createTable('dealer_profiles', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          unique: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        company_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        door_no: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        building_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        street_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        pincode: {
          type: Sequelize.STRING(6),
          allowNull: false,
        },
        gst_no: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        license_no: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        contact_person: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    // 3. Add district_id, state_id, and is_verified columns to users table if missing
    const userTableDescription = await queryInterface.describeTable('users');
    if (!userTableDescription.district_id) {
      await queryInterface.addColumn('users', 'district_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'districts',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }

    if (!userTableDescription.state_id) {
      await queryInterface.addColumn('users', 'state_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'states',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }

    if (!userTableDescription.is_verified) {
      await queryInterface.addColumn('users', 'is_verified', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }

    // 4. Add buyer_id to cars table if missing
    const carTableDescription = await queryInterface.describeTable('cars');
    if (!carTableDescription.buyer_id) {
      await queryInterface.addColumn('cars', 'buyer_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (tables.includes('dealer_profiles')) {
      await queryInterface.dropTable('dealer_profiles');
    }

    if (tables.includes('customer_profiles')) {
      await queryInterface.dropTable('customer_profiles');
    }

    const carTableDescription = await queryInterface.describeTable('cars');
    if (carTableDescription.buyer_id) {
      await queryInterface.removeColumn('cars', 'buyer_id');
    }

    const userTableDescription = await queryInterface.describeTable('users');
    if (userTableDescription.district_id) {
      await queryInterface.removeColumn('users', 'district_id');
    }
    if (userTableDescription.state_id) {
      await queryInterface.removeColumn('users', 'state_id');
    }
  },
};
