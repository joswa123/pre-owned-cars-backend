'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const brandDesc = await queryInterface.describeTable('brands');
    const modelDesc = await queryInterface.describeTable('models');
    const variantDesc = await queryInterface.describeTable('variants');

    // 1. Brands table enhancement
    if (!brandDesc.is_active) {
      await queryInterface.addColumn('brands', 'is_active', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      });
    }

    // 2. Models table enhancement
    if (!modelDesc.body_type) {
      await queryInterface.addColumn('models', 'body_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }

    if (!modelDesc.start_year) {
      await queryInterface.addColumn('models', 'start_year', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!modelDesc.end_year) {
      await queryInterface.addColumn('models', 'end_year', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!modelDesc.is_active) {
      await queryInterface.addColumn('models', 'is_active', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      });
    }

    // 3. Variants table enhancement
    if (!variantDesc.fuel_type) {
      await queryInterface.addColumn('variants', 'fuel_type', {
        type: Sequelize.ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'),
        allowNull: true,
      });
    }

    if (!variantDesc.transmission) {
      await queryInterface.addColumn('variants', 'transmission', {
        type: Sequelize.ENUM('Manual', 'Automatic', 'CVT', 'DCT'),
        allowNull: true,
      });
    }

    if (!variantDesc.engine_cc) {
      await queryInterface.addColumn('variants', 'engine_cc', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!variantDesc.price) {
      await queryInterface.addColumn('variants', 'price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (!variantDesc.is_active) {
      await queryInterface.addColumn('variants', 'is_active', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const brandDesc = await queryInterface.describeTable('brands');
    const modelDesc = await queryInterface.describeTable('models');
    const variantDesc = await queryInterface.describeTable('variants');

    if (variantDesc.is_active) await queryInterface.removeColumn('variants', 'is_active');
    if (variantDesc.price) await queryInterface.removeColumn('variants', 'price');
    if (variantDesc.engine_cc) await queryInterface.removeColumn('variants', 'engine_cc');
    if (variantDesc.transmission) await queryInterface.removeColumn('variants', 'transmission');
    if (variantDesc.fuel_type) await queryInterface.removeColumn('variants', 'fuel_type');

    if (modelDesc.is_active) await queryInterface.removeColumn('models', 'is_active');
    if (modelDesc.end_year) await queryInterface.removeColumn('models', 'end_year');
    if (modelDesc.start_year) await queryInterface.removeColumn('models', 'start_year');
    if (modelDesc.body_type) await queryInterface.removeColumn('models', 'body_type');

    if (brandDesc.is_active) await queryInterface.removeColumn('brands', 'is_active');
  },
};
