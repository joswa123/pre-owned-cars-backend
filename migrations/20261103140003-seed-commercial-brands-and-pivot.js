'use strict';
const { randomUUID } = require('crypto');

const COMMERCIAL_BRANDS = [
  { name: 'Ashok Leyland', slug: 'ashok-leyland' },
  { name: 'BharatBenz', slug: 'bharatbenz' },
  { name: 'Eicher', slug: 'eicher' },
  { name: 'Force Motors', slug: 'force-motors' },
  { name: 'Tata Motors', slug: 'tata-motors' },
  { name: 'Mahindra', slug: 'mahindra' },
  { name: 'Swaraj', slug: 'swaraj' },
  { name: 'Sonalika', slug: 'sonalika' },
  { name: 'John Deere', slug: 'john-deere' },
  { name: 'JCB', slug: 'jcb' },
  { name: 'Piaggio', slug: 'piaggio' },
  { name: 'Bajaj', slug: 'bajaj' },
  { name: 'Isuzu', slug: 'isuzu' },
  { name: 'Massey Ferguson', slug: 'massey-ferguson' },
  { name: 'New Holland', slug: 'new-holland' },
];

// Brands that were newly created specifically for commercial vehicles (to be cleaned up in down)
const NEW_COMMERCIAL_SLUGS = [
  'ashok-leyland',
  'bharatbenz',
  'eicher',
  'force-motors',
  'swaraj',
  'sonalika',
  'john-deere',
  'jcb',
  'piaggio',
  'bajaj',
  'isuzu',
  'massey-ferguson',
  'new-holland',
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Find Commercial Category ID
    const [catRows] = await queryInterface.sequelize.query(
      "SELECT id FROM categories WHERE slug = 'commercial' LIMIT 1"
    );
    if (!catRows.length) {
      console.warn('Commercial category not found, skipping commercial brand seeding');
      return;
    }
    const commercialCategoryId = catRows[0].id;

    // 2. Fetch all 10 commercial vehicle types
    const [types] = await queryInterface.sequelize.query(
      'SELECT id, name, slug FROM car_types WHERE category_id = :catId',
      { replacements: { catId: commercialCategoryId } }
    );

    // 3. Upsert each brand and link to commercial vehicle types
    for (const b of COMMERCIAL_BRANDS) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM brands WHERE slug = :slug OR name = :name LIMIT 1',
        { replacements: { slug: b.slug, name: b.name } }
      );
      let brandId;
      if (existing.length > 0) {
        brandId = existing[0].id;
      } else {
        brandId = randomUUID();
        await queryInterface.sequelize.query(
          'INSERT INTO brands (id, name, slug, is_active, created_at, updated_at) VALUES (:id, :name, :slug, 1, NOW(), NOW())',
          { replacements: { id: brandId, name: b.name, slug: b.slug } }
        );
      }

      // Link brand to each commercial vehicle type
      for (const t of types) {
        const [pivotExisting] = await queryInterface.sequelize.query(
          'SELECT id FROM brand_types WHERE brand_id = :brandId AND type_id = :typeId LIMIT 1',
          { replacements: { brandId, typeId: t.id } }
        );
        if (pivotExisting.length === 0) {
          await queryInterface.sequelize.query(
            'INSERT INTO brand_types (id, brand_id, type_id, created_at, updated_at) VALUES (:id, :brandId, :typeId, NOW(), NOW())',
            { replacements: { id: randomUUID(), brandId, typeId: t.id } }
          );
        }
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Get Commercial Category ID
    const [catRows] = await queryInterface.sequelize.query(
      "SELECT id FROM categories WHERE slug = 'commercial' LIMIT 1"
    );
    if (catRows.length > 0) {
      const commercialCategoryId = catRows[0].id;
      // Remove pivot entries linking any brand to commercial vehicle types
      await queryInterface.sequelize.query(`
        DELETE bt FROM brand_types bt
        JOIN car_types ct ON bt.type_id = ct.id
        WHERE ct.category_id = :catId
      `, { replacements: { catId: commercialCategoryId } });
    }

    // 2. Remove newly seeded commercial brands (do NOT delete Tata Motors or Mahindra)
    await queryInterface.sequelize.query(
      'DELETE FROM brands WHERE slug IN (:slugs)',
      { replacements: { slugs: NEW_COMMERCIAL_SLUGS } }
    );
  },
};

