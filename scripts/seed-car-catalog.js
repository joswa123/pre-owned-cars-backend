const sequelize = require('../src/config/database');
const carCatalogService = require('../src/services/carCatalogService');
const carData = require('./car-catalog-data.json');

/**
 * Baseline Vehicle Catalog Seeder Script
 * Idempotently populates Indian car brands, models, and variants.
 */
(async () => {
  try {
    console.log('⏳ Connecting to database for catalog seeding...');
    await sequelize.authenticate();
    console.log('✅ Connected to database.');

    console.log('⏳ Seeding vehicle catalog baseline dataset...');
    const summary = await carCatalogService.syncCatalogData(carData.brands);

    console.log(`✅ Catalog seeding completed!`);
    console.log(`📊 Summary: ${summary.createdCount} record(s) created, ${summary.updatedCount} record(s) updated.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Catalog seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
