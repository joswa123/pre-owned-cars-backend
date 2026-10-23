const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'category';
}

async function migrateCarTypes() {
  await sequelize.authenticate();
  console.log('Connected to DB:', process.env.DB_NAME);

  const [cols] = await sequelize.query("SHOW COLUMNS FROM car_types;");
  const colNames = cols.map((c) => c.Field);

  // 1. Add image_public_id if missing
  if (!colNames.includes('image_public_id')) {
    console.log('Adding image_public_id column...');
    await sequelize.query("ALTER TABLE car_types ADD COLUMN image_public_id VARCHAR(255) NULL AFTER icon_url;");
    console.log('Added image_public_id column.');
  }

  // 2. Add is_active if missing
  if (!colNames.includes('is_active')) {
    console.log('Adding is_active column...');
    await sequelize.query("ALTER TABLE car_types ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER `order`;");
    console.log('Added is_active column.');
  }

  // 3. Add slug if missing
  if (!colNames.includes('slug')) {
    console.log('Adding slug column...');
    await sequelize.query("ALTER TABLE car_types ADD COLUMN slug VARCHAR(70) NULL AFTER name;");
    console.log('Added slug column.');
  }

  // 4. Backfill slugs for existing rows
  const [rows] = await sequelize.query("SELECT id, name, slug FROM car_types;");
  const usedSlugs = new Set();

  for (const row of rows) {
    let baseSlug = slugify(row.name);
    let candidate = baseSlug;
    let counter = 1;
    while (usedSlugs.has(candidate)) {
      candidate = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(candidate);

    if (row.slug !== candidate) {
      await sequelize.query("UPDATE car_types SET slug = ? WHERE id = ?;", {
        replacements: [candidate, row.id],
      });
      console.log(`Backfilled slug for "${row.name}" -> "${candidate}"`);
    }
  }

  // 5. Ensure UNIQUE index on slug if not already present
  const [indexes] = await sequelize.query("SHOW INDEX FROM car_types;");
  const indexNames = indexes.map((idx) => idx.Key_name);
  if (!indexNames.includes('car_types_slug_unique') && !indexNames.includes('slug')) {
    try {
      console.log('Adding UNIQUE index on slug...');
      await sequelize.query("ALTER TABLE car_types MODIFY COLUMN slug VARCHAR(70) NOT NULL;");
      await sequelize.query("ALTER TABLE car_types ADD UNIQUE INDEX car_types_slug_unique (slug);");
      console.log('Added UNIQUE index on slug.');
    } catch (e) {
      console.warn('Index notice:', e.message);
    }
  }

  console.log('✅ car_types schema migration completed successfully.');
  process.exit(0);
}

migrateCarTypes().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
