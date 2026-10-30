'use strict';

require('dotenv').config();
const crypto = require('crypto');
const sequelize = require('../src/config/database');

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

async function seedCommercialTypes() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database:', sequelize.config.database);

    let commercialCategoryId = 'c72aa0fb-8a58-4c53-a3d8-05b5dd231d77';
    const [rows] = await sequelize.query(
      "SELECT id FROM categories WHERE slug = 'commercial' LIMIT 1"
    );
    if (rows && rows.length > 0) {
      commercialCategoryId = rows[0].id;
    }

    console.log(`Using Commercial Category ID: ${commercialCategoryId}`);

    for (const item of COMMERCIAL_TYPES) {
      const [existing] = await sequelize.query(
        `SELECT id, name FROM car_types WHERE name = ${sequelize.escape(item.name)} OR slug = ${sequelize.escape(item.slug)} LIMIT 1`
      );

      if (!existing || existing.length === 0) {
        const id = crypto.randomUUID();
        await sequelize.query(
          `INSERT INTO car_types (id, name, slug, \`order\`, is_active, category_id, created_at, updated_at) 
           VALUES (
             '${id}', 
             ${sequelize.escape(item.name)}, 
             ${sequelize.escape(item.slug)}, 
             ${item.order}, 
             1, 
             '${commercialCategoryId}', 
             NOW(), 
             NOW()
           )`
        );
        console.log(`   + Created: ${item.name} (${item.slug})`);
      } else {
        await sequelize.query(
          `UPDATE car_types SET category_id = '${commercialCategoryId}' WHERE id = '${existing[0].id}'`
        );
        console.log(`   * Updated existing: ${item.name} (id: ${existing[0].id})`);
      }
    }

    console.log('🎉 Commercial Vehicle Types seeded successfully!');
  } catch (err) {
    console.error('❌ Error seeding commercial types:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedCommercialTypes();
