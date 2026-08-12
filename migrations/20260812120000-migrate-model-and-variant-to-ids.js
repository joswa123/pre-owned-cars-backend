'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const carTableDescription = await queryInterface.describeTable('cars');

      // 1. Add model_id and variant_id columns (allow NULL initially)
      if (!carTableDescription.model_id) {
        await queryInterface.addColumn('cars', 'model_id', {
          type: Sequelize.UUID,
          allowNull: true,
        }, { transaction });
      }

      if (!carTableDescription.variant_id) {
        await queryInterface.addColumn('cars', 'variant_id', {
          type: Sequelize.UUID,
          allowNull: true,
        }, { transaction });
      }

      // 2. Backfill data from string columns if they exist
      if (carTableDescription.model) {
        await queryInterface.sequelize.query(`
          UPDATE cars c
          LEFT JOIN models m ON LOWER(m.name) = LOWER(c.model)
          SET c.model_id = m.id
          WHERE c.model IS NOT NULL AND c.model_id IS NULL;
        `, { transaction });
      }

      if (carTableDescription.variant) {
        await queryInterface.sequelize.query(`
          UPDATE cars c
          LEFT JOIN variants v ON LOWER(v.name) = LOWER(c.variant)
          SET c.variant_id = v.id
          WHERE c.variant IS NOT NULL AND c.variant_id IS NULL;
        `, { transaction });
      }

      // 3. Add Foreign Key constraints
      // Using raw SQL for compatibility with older Sequelize versions on alter table
      await queryInterface.sequelize.query(`
        ALTER TABLE cars 
        ADD CONSTRAINT cars_model_id_fk FOREIGN KEY (model_id) REFERENCES models (id) ON DELETE RESTRICT ON UPDATE CASCADE;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE cars 
        ADD CONSTRAINT cars_variant_id_fk FOREIGN KEY (variant_id) REFERENCES variants (id) ON DELETE RESTRICT ON UPDATE CASCADE;
      `, { transaction });

      // Add indexes
      await queryInterface.addIndex('cars', ['model_id'], { transaction });
      await queryInterface.addIndex('cars', ['variant_id'], { transaction });

      // 4. Safely drop the old string columns
      if (carTableDescription.model) {
        await queryInterface.removeColumn('cars', 'model', { transaction });
      }
      
      if (carTableDescription.variant) {
        await queryInterface.removeColumn('cars', 'variant', { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const carTableDescription = await queryInterface.describeTable('cars');

      // 1. Add back string columns
      if (!carTableDescription.model) {
        await queryInterface.addColumn('cars', 'model', {
          type: Sequelize.STRING(50),
          allowNull: true,
        }, { transaction });
      }

      if (!carTableDescription.variant) {
        await queryInterface.addColumn('cars', 'variant', {
          type: Sequelize.STRING(50),
          allowNull: true,
        }, { transaction });
      }

      // 2. Restore string data from foreign keys
      if (carTableDescription.model_id) {
        await queryInterface.sequelize.query(`
          UPDATE cars c
          JOIN models m ON c.model_id = m.id
          SET c.model = m.name;
        `, { transaction });
      }

      if (carTableDescription.variant_id) {
        await queryInterface.sequelize.query(`
          UPDATE cars c
          JOIN variants v ON c.variant_id = v.id
          SET c.variant = v.name;
        `, { transaction });
      }

      // 3. Drop foreign keys and IDs
      await queryInterface.sequelize.query(`ALTER TABLE cars DROP FOREIGN KEY cars_model_id_fk;`, { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE cars DROP FOREIGN KEY cars_variant_id_fk;`, { transaction });
      
      await queryInterface.removeColumn('cars', 'model_id', { transaction });
      await queryInterface.removeColumn('cars', 'variant_id', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
