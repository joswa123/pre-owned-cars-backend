'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Add external_id to brands
      const brandsTable = await queryInterface.describeTable('brands');
      if (!brandsTable.external_id) {
        await queryInterface.addColumn('brands', 'external_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          unique: true,
        }, { transaction });
      }

      // 2. Add external_id to models
      const modelsTable = await queryInterface.describeTable('models');
      if (!modelsTable.external_id) {
        await queryInterface.addColumn('models', 'external_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          unique: true,
        }, { transaction });
      }

      // 3. Add external_id to variants
      const variantsTable = await queryInterface.describeTable('variants');
      if (!variantsTable.external_id) {
        await queryInterface.addColumn('variants', 'external_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          unique: true,
        }, { transaction });
      }

      // Add indexes
      try {
        await queryInterface.addIndex('brands', ['external_id'], {
          name: 'brands_external_id_idx',
          unique: true,
          transaction,
        });
      } catch (e) {
        console.warn('brands_external_id_idx warning:', e.message);
      }

      try {
        await queryInterface.addIndex('models', ['external_id'], {
          name: 'models_external_id_idx',
          unique: true,
          transaction,
        });
      } catch (e) {
        console.warn('models_external_id_idx warning:', e.message);
      }

      try {
        await queryInterface.addIndex('variants', ['external_id'], {
          name: 'variants_external_id_idx',
          unique: true,
          transaction,
        });
      } catch (e) {
        console.warn('variants_external_id_idx warning:', e.message);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const brandsTable = await queryInterface.describeTable('brands');
      if (brandsTable.external_id) {
        try { await queryInterface.removeIndex('brands', 'brands_external_id_idx', { transaction }); } catch (e) {}
        await queryInterface.removeColumn('brands', 'external_id', { transaction });
      }

      const modelsTable = await queryInterface.describeTable('models');
      if (modelsTable.external_id) {
        try { await queryInterface.removeIndex('models', 'models_external_id_idx', { transaction }); } catch (e) {}
        await queryInterface.removeColumn('models', 'external_id', { transaction });
      }

      const variantsTable = await queryInterface.describeTable('variants');
      if (variantsTable.external_id) {
        try { await queryInterface.removeIndex('variants', 'variants_external_id_idx', { transaction }); } catch (e) {}
        await queryInterface.removeColumn('variants', 'external_id', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
