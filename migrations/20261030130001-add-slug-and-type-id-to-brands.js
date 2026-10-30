'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('brands');

    if (!tableInfo.slug) {
      await queryInterface.addColumn('brands', 'slug', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });

      await queryInterface.addIndex('brands', ['slug'], {
        name: 'idx_brands_slug',
      });
    }

    if (!tableInfo.type_id) {
      // Add type_id with matching collation for car_types.id
      await queryInterface.sequelize.query(`
        ALTER TABLE brands 
        ADD COLUMN type_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
        ADD CONSTRAINT fk_brands_type_id FOREIGN KEY (type_id) REFERENCES car_types(id) ON DELETE SET NULL ON UPDATE CASCADE;
      `);

      await queryInterface.addIndex('brands', ['type_id'], {
        name: 'idx_brands_type_id',
      });
    }

    // Backfill slugs for existing brands
    try {
      const [brands] = await queryInterface.sequelize.query(
        "SELECT id, name FROM brands WHERE slug IS NULL OR slug = ''"
      );
      for (const brand of brands) {
        const slug = String(brand.name)
          .trim()
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

        await queryInterface.sequelize.query(
          `UPDATE brands SET slug = ${queryInterface.sequelize.escape(slug)} WHERE id = '${brand.id}'`
        );
      }
    } catch (err) {
      console.warn('Notice: brand slug backfill warning:', err.message);
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('brands');
    if (tableInfo.type_id) {
      try {
        await queryInterface.sequelize.query('ALTER TABLE brands DROP FOREIGN KEY fk_brands_type_id;');
      } catch (e) {}
      try {
        await queryInterface.removeIndex('brands', 'idx_brands_type_id');
      } catch (e) {}
      await queryInterface.removeColumn('brands', 'type_id');
    }
    if (tableInfo.slug) {
      try {
        await queryInterface.removeIndex('brands', 'idx_brands_slug');
      } catch (e) {}
      await queryInterface.removeColumn('brands', 'slug');
    }
  },
};
