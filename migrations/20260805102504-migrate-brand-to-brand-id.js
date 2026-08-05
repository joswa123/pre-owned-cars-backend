'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Add `brand_id` column to `cars` (allow NULL initially)
      await queryInterface.addColumn('cars', 'brand_id', {
        type: Sequelize.UUID,
        allowNull: true,
      }, { transaction });

      // 2. Backfill `brand_id` by matching `cars.brand` with `brands.name`
      await queryInterface.sequelize.query(
        `UPDATE cars c 
         JOIN brands b ON LOWER(c.brand) = LOWER(b.name) 
         SET c.brand_id = b.id;`,
        { transaction }
      );

      // 3. Handle unmatched brands by setting them to 'Other' brand
      const [otherBrandRes] = await queryInterface.sequelize.query(
        `SELECT id FROM brands WHERE name = 'Other' LIMIT 1;`,
        { transaction }
      );
      
      if (otherBrandRes && otherBrandRes.length > 0) {
        const otherId = otherBrandRes[0].id;
        await queryInterface.sequelize.query(
          `UPDATE cars SET brand_id = '${otherId}' WHERE brand_id IS NULL;`,
          { transaction }
        );
      } else {
        console.warn('WARN: If there are NULL brand_ids and Other is missing, the next step will fail.');
      }

      // 4. Alter `brand_id` to NOT NULL
      await queryInterface.changeColumn('cars', 'brand_id', {
        type: Sequelize.UUID,
        allowNull: false,
      }, { transaction });

      // 5. Add Foreign Key Constraint (using raw SQL for Sequelize v3 compatibility)
      await queryInterface.sequelize.query(
        `ALTER TABLE cars ADD CONSTRAINT cars_brand_id_fk FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE RESTRICT ON UPDATE CASCADE;`,
        { transaction }
      );

      // 6. Add Index on brand_id
      await queryInterface.addIndex('cars', ['brand_id'], { transaction });

      // 7. Drop the old `brand` column
      await queryInterface.removeColumn('cars', 'brand', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Add `brand` string column back to `cars`
      await queryInterface.addColumn('cars', 'brand', {
        type: Sequelize.STRING(100),
        allowNull: true, // Allow null initially for backfill
      }, { transaction });

      // 2. Populate `cars.brand` from `brands.name`
      await queryInterface.sequelize.query(
        `UPDATE cars c 
         JOIN brands b ON c.brand_id = b.id 
         SET c.brand = b.name;`,
        { transaction }
      );

      // 3. Alter `brand` to NOT NULL
      await queryInterface.changeColumn('cars', 'brand', {
        type: Sequelize.STRING(100),
        allowNull: false,
      }, { transaction });

      // 4. Remove Foreign Key Constraint (raw SQL)
      await queryInterface.sequelize.query(
        `ALTER TABLE cars DROP FOREIGN KEY cars_brand_id_fk;`,
        { transaction }
      );
      
      // 5. Drop `brand_id` column
      await queryInterface.removeColumn('cars', 'brand_id', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
