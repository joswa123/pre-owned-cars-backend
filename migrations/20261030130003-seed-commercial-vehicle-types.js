'use strict';

const crypto = require('crypto');

const COMMERCIAL_TYPES = [
  { name: 'Auto-rickshaws & E-rickshaws', slug: 'auto-rickshaws-and-e-rickshaws', order: 101 },
  { name: 'Buses', slug: 'buses', order: 102 },
  { name: 'Trucks', slug: 'trucks', order: 103 },
  { name: 'Heavy Machinery', slug: 'heavy-machinery', order: 104 },
  { name: 'Modified Jeeps', slug: 'modified-jeeps', order: 105 },
  { name: 'Pick-up vans / Pick-up trucks', slug: 'pick-up-vans-pick-up-trucks', order: 106 },
  { name: 'Scrap Cars', slug: 'scrap-cars', order: 107 },
  { name: 'Taxi Cabs', slug: 'taxi-cabs', order: 108 },
  { name: 'Tractors', slug: 'tractors', order: 109 },
  { name: 'Commercial Others', slug: 'commercial-others', order: 110 },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Resolve Commercial Category ID
    let commercialCategoryId = 'c72aa0fb-8a58-4c53-a3d8-05b5dd231d77';
    try {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM categories WHERE slug = 'commercial' LIMIT 1"
      );
      if (rows && rows.length > 0) {
        commercialCategoryId = rows[0].id;
      }
    } catch (err) {
      console.warn('Could not query categories for commercial category:', err.message);
    }

    const now = new Date();

    for (const item of COMMERCIAL_TYPES) {
      // Check if type already exists by name or slug
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM car_types WHERE name = ${queryInterface.sequelize.escape(item.name)} OR slug = ${queryInterface.sequelize.escape(item.slug)} LIMIT 1`
      );

      if (!existing || existing.length === 0) {
        const id = crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4();
        await queryInterface.sequelize.query(
          `INSERT INTO car_types (id, name, slug, \`order\`, is_active, category_id, created_at, updated_at) 
           VALUES (
             '${id}', 
             ${queryInterface.sequelize.escape(item.name)}, 
             ${queryInterface.sequelize.escape(item.slug)}, 
             ${item.order}, 
             1, 
             '${commercialCategoryId}', 
             NOW(), 
             NOW()
           )`
        );
      } else {
        // Ensure category_id is set to Commercial
        await queryInterface.sequelize.query(
          `UPDATE car_types SET category_id = '${commercialCategoryId}' WHERE id = '${existing[0].id}'`
        );
      }
    }
  },

  down: async (queryInterface) => {
    const slugs = COMMERCIAL_TYPES.map(t => `'${t.slug}'`).join(', ');
    await queryInterface.sequelize.query(
      `DELETE FROM car_types WHERE slug IN (${slugs})`
    );
  },
};
