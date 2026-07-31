'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Create districts table if it does not exist
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('districts')) {
      await queryInterface.createTable('districts', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        state_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'states',
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false,
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

    // 2. Add district_id column to cities table if missing
    const cityTableDescription = await queryInterface.describeTable('cities');
    if (!cityTableDescription.district_id) {
      await queryInterface.addColumn('cities', 'district_id', {
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

    // 3. Add city_id column to users table if missing
    const userTableDescription = await queryInterface.describeTable('users');
    if (!userTableDescription.city_id) {
      await queryInterface.addColumn('users', 'city_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'cities',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }

    // 4. Modify role ENUM in users table to include 'customer' and 'dealer'
    if (userTableDescription.role) {
      await queryInterface.changeColumn('users', 'role', {
        type: Sequelize.ENUM('customer', 'dealer', 'buyer', 'seller', 'company_seller', 'admin'),
        defaultValue: 'customer',
      });
    }

    // 5. Add seller_type column to cars table if missing
    const carTableDescription = await queryInterface.describeTable('cars');
    if (!carTableDescription.seller_type) {
      await queryInterface.addColumn('cars', 'seller_type', {
        type: Sequelize.ENUM('private', 'dealer'),
        allowNull: false,
        defaultValue: 'private',
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const cityTableDescription = await queryInterface.describeTable('cities');
    if (cityTableDescription.district_id) {
      await queryInterface.removeColumn('cities', 'district_id');
    }

    const userTableDescription = await queryInterface.describeTable('users');
    if (userTableDescription.city_id) {
      await queryInterface.removeColumn('users', 'city_id');
    }

    const carTableDescription = await queryInterface.describeTable('cars');
    if (carTableDescription.seller_type) {
      await queryInterface.removeColumn('cars', 'seller_type');
    }

    const tables = await queryInterface.showAllTables();
    if (tables.includes('districts')) {
      await queryInterface.dropTable('districts');
    }
  }
};
