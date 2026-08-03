'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const userTableDescription = await queryInterface.describeTable('users');
    const carTableDescription = await queryInterface.describeTable('cars');

    // 1. Clean up users table
    if (userTableDescription.aadhaar) {
      await queryInterface.removeColumn('users', 'aadhaar');
    }
    if (userTableDescription.aadhar) {
      await queryInterface.removeColumn('users', 'aadhar');
    }

    // Modify role ENUM to strictly ['customer', 'dealer', 'admin']
    if (userTableDescription.role) {
      await queryInterface.sequelize.query(
        `UPDATE users SET role = 'customer' WHERE role NOT IN ('customer', 'dealer', 'admin') OR role IS NULL;`
      );
      await queryInterface.changeColumn('users', 'role', {
        type: Sequelize.ENUM('customer', 'dealer', 'admin'),
        defaultValue: 'customer',
        allowNull: false,
      });
    }

    // 2. Add user_id column to cars table if missing and migrate dealer_id -> user_id
    if (!carTableDescription.user_id) {
      await queryInterface.addColumn('cars', 'user_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });

      // Migrate existing dealer_id values to user_id and make dealer_id nullable
      if (carTableDescription.dealer_id) {
        await queryInterface.sequelize.query(
          `UPDATE cars SET user_id = dealer_id WHERE user_id IS NULL AND dealer_id IS NOT NULL;`
        );
        try {
          await queryInterface.changeColumn('cars', 'dealer_id', {
            type: Sequelize.UUID,
            allowNull: true,
          });
        } catch (e) {
          // If foreign key prevents changeColumn, alter directly via raw query
          await queryInterface.sequelize.query(
            `ALTER TABLE cars MODIFY COLUMN dealer_id VARCHAR(36) NULL;`
          );
        }
      }
    }

    // 3. Add new fields to cars table if missing
    if (!carTableDescription.body_type) {
      await queryInterface.addColumn('cars', 'body_type', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'SUV',
      });

      // Copy car_type to body_type if car_type existed
      if (carTableDescription.car_type) {
        await queryInterface.sequelize.query(
          `UPDATE cars SET body_type = car_type WHERE car_type IS NOT NULL;`
        );
      }
    }

    if (!carTableDescription.board_type) {
      await queryInterface.addColumn('cars', 'board_type', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'White',
      });

      // Copy number_plate to board_type if number_plate existed
      if (carTableDescription.number_plate) {
        await queryInterface.sequelize.query(
          `UPDATE cars SET board_type = number_plate WHERE number_plate IS NOT NULL;`
        );
      }
    }

    if (!carTableDescription.insurance_expiry_date) {
      await queryInterface.addColumn('cars', 'insurance_expiry_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!carTableDescription.b2b_listing) {
      await queryInterface.addColumn('cars', 'b2b_listing', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!carTableDescription.posted_by_type) {
      await queryInterface.addColumn('cars', 'posted_by_type', {
        type: Sequelize.ENUM('customer', 'dealer'),
        allowNull: false,
        defaultValue: 'customer',
      });

      // Populate posted_by_type based on user's role
      await queryInterface.sequelize.query(`
        UPDATE cars c
        JOIN users u ON c.user_id = u.id
        SET c.posted_by_type = IF(u.role = 'dealer', 'dealer', 'customer');
      `);
    }

    if (!carTableDescription.is_available) {
      await queryInterface.addColumn('cars', 'is_available', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!carTableDescription.engine_cc) {
      await queryInterface.addColumn('cars', 'engine_cc', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    // 4. Safely drop unused legacy columns from cars table
    const columnsToDrop = [
      'purchase_date',
      'exterior_colour',
      'interior_colour',
      'state',
      'city',
      'is_featured',
      'views',
      'seller_type',
      'number_plate_color',
      'appointment_required',
    ];

    for (const col of columnsToDrop) {
      if (carTableDescription[col]) {
        try {
          await queryInterface.removeColumn('cars', col);
        } catch (err) {
          console.log(`Note: could not remove column ${col}:`, err.message);
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const carTableDescription = await queryInterface.describeTable('cars');

    if (carTableDescription.posted_by_type) {
      await queryInterface.removeColumn('cars', 'posted_by_type');
    }
    if (carTableDescription.b2b_listing) {
      await queryInterface.removeColumn('cars', 'b2b_listing');
    }
    if (carTableDescription.insurance_expiry_date) {
      await queryInterface.removeColumn('cars', 'insurance_expiry_date');
    }
    if (carTableDescription.engine_cc) {
      await queryInterface.removeColumn('cars', 'engine_cc');
    }
    if (carTableDescription.is_available) {
      await queryInterface.removeColumn('cars', 'is_available');
    }
    if (carTableDescription.body_type) {
      await queryInterface.removeColumn('cars', 'body_type');
    }
    if (carTableDescription.board_type) {
      await queryInterface.removeColumn('cars', 'board_type');
    }
  },
};
