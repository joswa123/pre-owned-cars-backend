// scripts/sync-external-ids.js
/**
 * Backfill & Synchronization Script for External Catalog IDs
 * Fetches Makes, Models, and Variants from the Vehicle Intelligence API
 * and maps their integer IDs to `external_id` in the local PostgreSQL/MySQL database.
 */

const https = require('https');
const { Brand, Model, Variant } = require('../src/models');
const sequelize = require('../src/config/database');
const { Op, fn, col } = require('sequelize');

const EXTERNAL_API = 'https://vehicle-intelligence-client-api.pages.dev/api';

const normalizeTransmission = (t) => {
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.includes('manual') && !lower.includes('automatic') && !lower.includes('auto')) return 'Manual';
  if (lower.includes('amt')) return 'AMT';
  if (lower.includes('cvt')) return 'CVT';
  if (lower.includes('dct') || lower.includes('dsg')) return 'DCT';
  if (lower.includes('auto')) return 'Automatic';
  return 'Manual';
};

const normalizeFuelType = (f) => {
  if (!f) return null;
  const lower = f.toLowerCase();
  if (lower.includes('petrol')) return 'Petrol';
  if (lower.includes('diesel')) return 'Diesel';
  if (lower.includes('electric') || lower.includes('ev')) return 'Electric';
  if (lower.includes('cng')) return 'CNG';
  if (lower.includes('lpg')) return 'LPG';
  if (lower.includes('hybrid')) return 'Hybrid';
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'NodeJS/SyncService' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode} from ${url}: ${data.substring(0, 100)}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });
};

async function syncCatalogExternalIds(options = {}) {
  console.log('🚀 Starting External Catalog ID Synchronization...');
  await sequelize.authenticate();
  console.log('✅ Connected to Database');

  const stats = {
    brandsUpdated: 0,
    brandsCreated: 0,
    modelsUpdated: 0,
    modelsCreated: 0,
    variantsUpdated: 0,
    variantsCreated: 0,
  };

  // 1. Fetch all makes
  console.log('\n📡 Fetching makes from external API...');
  const makesRes = await fetchJson(`${EXTERNAL_API}/makes`);
  const makes = makesRes && makesRes.data ? makesRes.data : [];
  console.log(`Found ${makes.length} makes in external catalog.`);

  for (const extMake of makes) {
    if (!extMake || !extMake.make_name || !extMake.make_id) continue;
    const makeName = extMake.make_name.trim();
    const makeId = parseInt(extMake.make_id, 10);

    // If specific brand filter passed
    if (options.make && options.make.toLowerCase() !== makeName.toLowerCase()) {
      continue;
    }

    // Find brand in DB by name or existing external_id
    let brand = await Brand.findOne({
      where: {
        [Op.or]: [
          sequelize.where(fn('LOWER', col('name')), makeName.toLowerCase()),
          { external_id: makeId },
        ],
      },
    });

    if (brand) {
      if (brand.external_id !== makeId) {
        await brand.update({ external_id: makeId });
        stats.brandsUpdated++;
        console.log(`  🔗 Updated Brand '${brand.name}' -> external_id: ${makeId}`);
      }
    } else {
      brand = await Brand.create({
        name: makeName,
        external_id: makeId,
        logo: extMake.logo_url || null,
        is_active: true,
      });
      stats.brandsCreated++;
      console.log(`  ➕ Created Brand '${makeName}' -> external_id: ${makeId}`);
    }

    if (options.brandsOnly) continue;

    await sleep(50);

    // 2. Fetch models for this make
    try {
      const modelsRes = await fetchJson(`${EXTERNAL_API}/models?make_id=${makeId}`);
      const extModels = modelsRes && modelsRes.data ? modelsRes.data : [];

      for (const extModel of extModels) {
        if (!extModel || !extModel.model_name || !extModel.model_id) continue;
        const modelName = extModel.model_name.trim();
        const rootName = extModel.root_name ? extModel.root_name.trim() : null;
        const modelId = parseInt(extModel.model_id, 10);

        let model = await Model.findOne({
          where: {
            brandId: brand.id,
            [Op.or]: [
              sequelize.where(fn('LOWER', col('name')), modelName.toLowerCase()),
              ...(rootName ? [sequelize.where(fn('LOWER', col('name')), rootName.toLowerCase())] : []),
              { external_id: modelId },
            ],
          },
        });

        if (model) {
          if (model.external_id !== modelId) {
            await model.update({ external_id: modelId });
            stats.modelsUpdated++;
            console.log(`    🔗 Updated Model '${model.name}' -> external_id: ${modelId}`);
          }
        } else {
          model = await Model.create({
            brandId: brand.id,
            name: rootName || modelName,
            external_id: modelId,
            image_url: extModel.image_url || null,
            is_active: true,
          });
          stats.modelsCreated++;
          console.log(`    ➕ Created Model '${model.name}' -> external_id: ${modelId}`);
        }

        if (options.modelsOnly) continue;

        await sleep(50);

        // 3. Fetch variants for this model
        try {
          const detailRes = await fetchJson(`${EXTERNAL_API}/models/${modelId}`);
          const variants = detailRes && detailRes.data && detailRes.data.variants ? detailRes.data.variants : [];

          for (const extVar of variants) {
            if (!extVar || !extVar.version_name || !extVar.version_id) continue;
            const versionName = extVar.version_name.trim();
            const versionId = parseInt(extVar.version_id, 10);
            const fuelType = normalizeFuelType(extVar.fuel_type);
            const transmission = normalizeTransmission(extVar.transmission);

            let variant = await Variant.findOne({
              where: {
                model_id: model.id,
                [Op.or]: [
                  sequelize.where(fn('LOWER', col('name')), versionName.toLowerCase()),
                  { external_id: versionId },
                ],
              },
            });

            if (variant) {
              if (variant.external_id !== versionId) {
                await variant.update({
                  external_id: versionId,
                  ...(fuelType && !variant.fuel_type ? { fuel_type: fuelType } : {}),
                  ...(transmission && !variant.transmission ? { transmission } : {}),
                });
                stats.variantsUpdated++;
              }
            } else {
              await Variant.create({
                model_id: model.id,
                name: versionName,
                external_id: versionId,
                fuel_type: fuelType,
                transmission: transmission,
                is_active: true,
              });
              stats.variantsCreated++;
            }
          }
        } catch (varErr) {
          console.warn(`    ⚠️ Failed to fetch variants for model ${modelId}: ${varErr.message}`);
        }
      }
    } catch (modelErr) {
      console.warn(`  ⚠️ Failed to fetch models for make ${makeId}: ${modelErr.message}`);
    }
  }

  console.log('\n========================================');
  console.log('🎉 External Catalog ID Sync Summary:');
  console.log(`  Brands updated:   ${stats.brandsUpdated}`);
  console.log(`  Brands created:   ${stats.brandsCreated}`);
  console.log(`  Models updated:   ${stats.modelsUpdated}`);
  console.log(`  Models created:   ${stats.modelsCreated}`);
  console.log(`  Variants updated: ${stats.variantsUpdated}`);
  console.log(`  Variants created: ${stats.variantsCreated}`);
  console.log('========================================\n');

  return stats;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    brandsOnly: args.includes('--brands-only'),
    modelsOnly: args.includes('--models-only'),
    make: args.find((a) => a.startsWith('--make='))?.split('=')[1] || null,
  };

  syncCatalogExternalIds(options)
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Sync failed:', err);
      process.exit(1);
    });
}

module.exports = syncCatalogExternalIds;
