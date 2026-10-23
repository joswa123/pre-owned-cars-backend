'use strict';

function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'category';
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('car_types');

    // 1. Add image_public_id if not present
    if (!table.image_public_id) {
      await queryInterface.addColumn('car_types', 'image_public_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    // 2. Add is_active if not present
    if (!table.is_active) {
      await queryInterface.addColumn('car_types', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    // 3. Add slug if not present
    if (!table.slug) {
      await queryInterface.addColumn('car_types', 'slug', {
        type: Sequelize.STRING(70),
        allowNull: true,
      });
    }

    // 4. Backfill slugs for any records missing slug
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, name, slug FROM car_types;'
    );
    const usedSlugs = new Set();

    for (const row of rows) {
      let baseSlug = slugify(row.name);
      let candidate = baseSlug;
      let counter = 1;
      while (usedSlugs.has(candidate)) {
        candidate = `${baseSlug}-${counter++}`;
      }
      usedSlugs.add(candidate);

      if (!row.slug || row.slug !== candidate) {
        await queryInterface.sequelize.query(
          'UPDATE car_types SET slug = ? WHERE id = ?;',
          { replacements: [candidate, row.id] }
        );
      }
    }

    // 5. Ensure UNIQUE constraint on slug
    try {
      await queryInterface.changeColumn('car_types', 'slug', {
        type: Sequelize.STRING(70),
        allowNull: false,
      });
      await queryInterface.addIndex('car_types', ['slug'], {
        unique: true,
        name: 'car_types_slug_unique',
      });
    } catch (e) {
      // Index may already exist
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('car_types');
    if (table.slug) {
      try {
        await queryInterface.removeIndex('car_types', 'car_types_slug_unique');
      } catch (e) {}
      await queryInterface.removeColumn('car_types', 'slug');
    }
    if (table.image_public_id) {
      await queryInterface.removeColumn('car_types', 'image_public_id');
    }
    if (table.is_active) {
      await queryInterface.removeColumn('car_types', 'is_active');
    }
  },
};
