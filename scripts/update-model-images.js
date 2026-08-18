'use strict';

require('dotenv').config({ override: true });
const { Brand, Model, sequelize } = require('../src/models');
const { Op, fn, col, where } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Normalization alias dictionary for brand names
const BRAND_ALIASES = {
  'tata': 'Tata Motors',
  'tata motors': 'Tata Motors',
  'maruti': 'Maruti Suzuki',
  'maruti suzuki': 'Maruti Suzuki',
  'suzuki': 'Maruti Suzuki',
  'mercedes': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'vw': 'Volkswagen',
  'volkswagen': 'Volkswagen',
  'chevy': 'Chevrolet',
  'chevrolet': 'Chevrolet',
  'citroen': 'Citroën',
  'citroën': 'Citroën',
};

/**
 * Normalizes brand name for lookup
 */
function normalizeBrandName(name) {
  if (!name) return '';
  const clean = name.trim().toLowerCase();
  return BRAND_ALIASES[clean] || name.trim();
}

/**
 * Normalize model name for matching
 */
function normalizeModelName(name) {
  if (!name) return '';
  return name.trim().toLowerCase()
    .replace(/\s*\([^)]*\)/g, '') // remove parenthesized parts like (Hyundai)
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Run Model Image Updates
 * @param {Array<{brandName: string, modelName: string, imageUrl: string}>} mappingList
 */
async function updateModelImages(mappingList = []) {
  // If no inline list passed, check for scripts/model-images.json
  let items = mappingList;
  if (!items || items.length === 0) {
    const jsonPath = path.join(__dirname, 'model-images.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        items = JSON.parse(raw);
      } catch (e) {
        console.error('⚠️ Could not parse model-images.json:', e.message);
      }
    }
  }

  if (!items || items.length === 0) {
    console.log('ℹ️ No model image mapping list provided. Place items in scripts/model-images.json or pass directly.');
    return { updated: 0, notFound: [], total: 0 };
  }

  console.log(`🚀 Starting model images update for ${items.length} entries...`);
  await sequelize.authenticate();

  let updated = 0;
  const notFound = [];
  const allBrands = await Brand.findAll();
  const allModels = await Model.findAll();

  const transaction = await sequelize.transaction();

  try {
    for (const item of items) {
      const rawBrand = item.brandName || item.brand || item.Brand || '';
      const rawModel = item.modelName || item.model || item.Model || '';
      const imageUrl = item.imageUrl || item.image_url || item.url || item.URL || '';

      if (!rawBrand || !rawModel || !imageUrl) {
        notFound.push({ ...item, reason: 'Missing brand, model, or URL' });
        continue;
      }

      const targetBrandName = normalizeBrandName(rawBrand).toLowerCase();

      // Find Brand
      const brand = allBrands.find(b => {
        const bName = b.name.toLowerCase();
        return bName === targetBrandName || 
               normalizeBrandName(b.name).toLowerCase() === targetBrandName ||
               bName.includes(targetBrandName) || 
               targetBrandName.includes(bName);
      });

      if (!brand) {
        notFound.push({ ...item, reason: `Brand not found: ${rawBrand}` });
        continue;
      }

      const targetModelName = normalizeModelName(rawModel);

      // Find Model under this Brand
      const modelsUnderBrand = allModels.filter(m => m.brandId === brand.id);
      let model = modelsUnderBrand.find(m => m.name.toLowerCase() === rawModel.trim().toLowerCase());

      if (!model) {
        // Try normalized name
        model = modelsUnderBrand.find(m => normalizeModelName(m.name) === targetModelName);
      }

      if (!model) {
        // Try fuzzy inclusion
        model = modelsUnderBrand.find(m => {
          const mNorm = normalizeModelName(m.name);
          return mNorm.includes(targetModelName) || targetModelName.includes(mNorm);
        });
      }

      if (!model) {
        notFound.push({ ...item, reason: `Model not found under ${brand.name}: ${rawModel}` });
        continue;
      }

      // Update image_url
      await model.update({ image_url: imageUrl.trim() }, { transaction });
      updated++;
    }

    await transaction.commit();
    console.log(`\n========================================`);
    console.log(`✅ Successfully updated ${updated} of ${items.length} model image URLs.`);
    if (notFound.length > 0) {
      console.log(`⚠️ Unmatched entries (${notFound.length}):`);
      notFound.forEach(n => console.log(`  - [${n.brandName || n.brand}] ${n.modelName || n.model}: ${n.reason}`));
    }
    console.log(`========================================\n`);

    return { updated, notFound, total: items.length };
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error during model images update:', error);
    throw error;
  }
}

if (require.main === module) {
  updateModelImages()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { updateModelImages, BRAND_ALIASES, normalizeBrandName, normalizeModelName };
