const https = require('https');
const { Brand, Model, Variant } = require('../models');
const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const { AppError } = require('./errorHandler');
const { FUEL_TYPE_MAP, TRANSMISSION_MAP } = require('../validations/carValidation');

const EXTERNAL_CATALOG_API = 'https://vehicle-intelligence-client-api.pages.dev/api';

const isUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

const fetchExternalJson = (url) => {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'NodeJS/CarService' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
};

const normalizeTransmission = (t) => {
  if (!t) return null;
  const lower = t.toLowerCase().trim();
  if (TRANSMISSION_MAP[lower]) return TRANSMISSION_MAP[lower];
  if (lower.includes('amt')) return 'Automatic (AMT)';
  if (lower.includes('imt')) return 'Clutchless Manual (IMT)';
  if (lower.includes('e-cvt') || lower.includes('ecvt')) return 'Automatic (e-CVT)';
  if (lower.includes('cvt')) return 'Automatic (CVT)';
  if (lower.includes('dct') || lower.includes('dsg')) return 'Automatic (DCT)';
  if (lower.includes('tc') || lower.includes('torque converter')) return 'Automatic (TC)';
  if (lower.includes('clutchless')) return 'Clutchless Manual (IMT)';
  if (lower.includes('auto')) return 'Automatic';
  if (lower.includes('manual')) return 'Manual';
  return t.trim();
};

const normalizeFuelType = (f) => {
  if (!f) return null;
  const lower = f.toLowerCase().trim();
  if (FUEL_TYPE_MAP[lower]) return FUEL_TYPE_MAP[lower];
  if (lower.includes('mild hybrid') && lower.includes('diesel')) return 'Mild Hybrid (Electric + Diesel)';
  if (lower.includes('mild hybrid')) return 'Mild Hybrid(Electric + Petrol)';
  if (lower.includes('plug-in') || lower.includes('plugin')) return 'Plug-in Hybrid (Electric + Petrol)';
  if (lower.includes('hybrid')) return 'Hybrid (Electric + Petrol)';
  if (lower.includes('electric') || lower.includes('ev')) return 'Electric';
  if (lower.includes('cng')) return 'CNG';
  if (lower.includes('lpg')) return 'LPG';
  if (lower.includes('petrol')) return 'Petrol';
  if (lower.includes('diesel')) return 'Diesel';
  return null;
};

/**
 * Resolve brand_id from UUID, external integer ID, or name string
 */
const resolveBrandId = async (input, transaction = null) => {
  if (!input && input !== 0) return null;

  const inputStr = typeof input === 'string' ? input.trim() : String(input);

  // 1. If it's a UUID, verify and return
  if (isUuid(inputStr)) {
    const brand = await Brand.findByPk(inputStr, { transaction });
    if (brand) return brand.id;
    throw new AppError(`Brand with ID ${inputStr} not found.`, 404);
  }

  // 2. If it's an integer / numeric string, lookup by external_id
  const numericId = parseInt(inputStr, 10);
  if (!isNaN(numericId) && /^\d+$/.test(inputStr)) {
    let brand = await Brand.findOne({
      where: { external_id: numericId },
      transaction,
    });
    if (brand) return brand.id;

    // Fallback: On-demand JIT sync from external API
    try {
      const makesRes = await fetchExternalJson(`${EXTERNAL_CATALOG_API}/makes`);
      const makes = makesRes && makesRes.data ? makesRes.data : [];
      const extMake = makes.find(m => m && parseInt(m.make_id, 10) === numericId);
      if (extMake) {
        brand = await Brand.findOne({
          where: sequelize.where(fn('LOWER', col('name')), extMake.make_name.trim().toLowerCase()),
          transaction,
        });
        if (brand) {
          await brand.update({ external_id: numericId, ...(extMake.logo_url && !brand.logo ? { logo: extMake.logo_url } : {}) }, { transaction });
        } else {
          brand = await Brand.create({
            name: extMake.make_name.trim(),
            external_id: numericId,
            logo: extMake.logo_url || '',
            is_active: true,
          }, { transaction });
        }
        if (brand) return brand.id;
      }
    } catch (e) {
      console.warn(`JIT fetch for make ${numericId} failed:`, e.message);
    }

    throw new AppError(`Brand with external ID ${numericId} not found.`, 404);
  }

  // 3. Lookup by brand name or create if not existing
  let brand = await Brand.findOne({
    where: sequelize.where(fn('LOWER', col('name')), inputStr.toLowerCase()),
    transaction,
  });
  if (!brand) {
    brand = await Brand.create({ name: inputStr, logo: '' }, { transaction });
  }
  return brand.id;
};

/**
 * Resolve model_id from UUID, external integer ID, or name string
 */
const resolveModelId = async (input, brandId = null, bodyType = 'SUV', transaction = null) => {
  if (!input && input !== 0) return null;

  const inputStr = typeof input === 'string' ? input.trim() : String(input);

  // 1. If it's a UUID, verify and return
  if (isUuid(inputStr)) {
    const model = await Model.findByPk(inputStr, { transaction });
    if (model) return model.id;
    throw new AppError(`Model with ID ${inputStr} not found.`, 404);
  }

  // 2. If it's an integer / numeric string, lookup by external_id
  const numericId = parseInt(inputStr, 10);
  if (!isNaN(numericId) && /^\d+$/.test(inputStr)) {
    const where = { external_id: numericId };
    if (brandId) where.brandId = brandId;

    let model = await Model.findOne({ where, transaction });
    if (!model && brandId) {
      // Fallback: check without brandId constraint
      model = await Model.findOne({ where: { external_id: numericId }, transaction });
    }
    if (model) return model.id;

    // Fallback: On-demand JIT sync from external API for this model
    try {
      const detailRes = await fetchExternalJson(`${EXTERNAL_CATALOG_API}/models/${numericId}`);
      if (detailRes && detailRes.data && detailRes.data.model_id) {
        const extModel = detailRes.data;
        const makeId = parseInt(extModel.make_id, 10);
        const modelName = (extModel.root_name || extModel.model_name || `Model ${numericId}`).trim();

        // Ensure brand exists
        let targetBrandId = brandId;
        if (!targetBrandId && makeId) {
          targetBrandId = await resolveBrandId(makeId, transaction);
        }
        if (!targetBrandId && extModel.make_name) {
          targetBrandId = await resolveBrandId(extModel.make_name, transaction);
        }

        if (targetBrandId) {
          model = await Model.findOne({
            where: {
              brandId: targetBrandId,
              [Op.or]: [
                sequelize.where(fn('LOWER', col('name')), modelName.toLowerCase()),
                { external_id: numericId },
              ],
            },
            transaction,
          });

          if (model) {
            const updates = {};
            if (model.external_id !== numericId) updates.external_id = numericId;
            if (extModel.image_url && !model.image_url) updates.image_url = extModel.image_url;
            if (Object.keys(updates).length > 0) {
              await model.update(updates, { transaction });
            }
          } else {
            model = await Model.create({
              brandId: targetBrandId,
              name: modelName,
              external_id: numericId,
              image_url: extModel.image_url || null,
              body_type: bodyType || 'SUV',
              is_active: true,
            }, { transaction });
          }

          // Also populate/update its variants if returned
          const variants = extModel.variants || [];
          for (const extVar of variants) {
            if (!extVar || !extVar.version_id) continue;
            const versionId = parseInt(extVar.version_id, 10);
            const versionName = (extVar.version_name || `Variant ${versionId}`).trim();
            const fuelType = normalizeFuelType(extVar.fuel_type);
            const transmission = normalizeTransmission(extVar.transmission);

            let v = await Variant.findOne({
              where: {
                model_id: model.id,
                [Op.or]: [
                  sequelize.where(fn('LOWER', col('name')), versionName.toLowerCase()),
                  { external_id: versionId },
                ],
              },
              transaction,
            });

            if (v) {
              if (v.external_id !== versionId) {
                await v.update({ external_id: versionId }, { transaction });
              }
            } else {
              await Variant.create({
                model_id: model.id,
                name: versionName,
                external_id: versionId,
                fuel_type: fuelType,
                transmission: transmission,
                is_active: true,
              }, { transaction });
            }
          }

          if (model) return model.id;
        }
      }
    } catch (e) {
      console.warn(`JIT fetch for model ${numericId} failed:`, e.message);
    }

    throw new AppError(`Model with external ID ${numericId} not found.`, 404);
  }

  // 3. Lookup by name under brandId or create if not existing
  const where = {
    [Op.and]: [sequelize.where(fn('LOWER', col('name')), inputStr.toLowerCase())],
  };
  if (brandId) where.brandId = brandId;

  let model = await Model.findOne({ where, transaction });
  if (!model) {
    if (!brandId) throw new AppError('Brand is required to create a new model.', 400);
    model = await Model.create(
      { name: inputStr, brandId, body_type: bodyType },
      { transaction }
    );
  }
  return model.id;
};

/**
 * Resolve variant_id from UUID, external integer ID, or name string
 */
const resolveVariantId = async (input, modelId = null, variantDefaults = {}, transaction = null) => {
  if (!input && input !== 0) {
    if (modelId) {
      let defaultVariant = await Variant.findOne({ where: { model_id: modelId }, transaction });
      if (!defaultVariant) {
        defaultVariant = await Variant.create(
          {
            name: 'Standard',
            model_id: modelId,
            fuel_type: variantDefaults.fuel_type || null,
            transmission: variantDefaults.transmission || null,
            price: variantDefaults.price || null,
          },
          { transaction }
        );
      }
      return defaultVariant ? defaultVariant.id : null;
    }
    return null;
  }

  const inputStr = typeof input === 'string' ? input.trim() : String(input);

  // 1. If it's a UUID, verify and return
  if (isUuid(inputStr)) {
    const where = { id: inputStr };
    if (modelId) where.model_id = modelId;

    let variant = await Variant.findOne({ where, transaction });
    if (!variant && modelId) {
      variant = await Variant.findByPk(inputStr, { transaction });
    }
    if (variant) return variant.id;
    throw new AppError(`Variant with ID ${inputStr} not found for this model.`, 404);
  }

  // 2. If it's an integer / numeric string, lookup by external_id
  const numericId = parseInt(inputStr, 10);
  if (!isNaN(numericId) && /^\d+$/.test(inputStr)) {
    const where = { external_id: numericId };
    if (modelId) where.model_id = modelId;

    let variant = await Variant.findOne({ where, transaction });
    if (!variant && modelId) {
      // Fallback: check without modelId constraint
      variant = await Variant.findOne({ where: { external_id: numericId }, transaction });
    }
    if (variant) return variant.id;

    // Fallback: On-demand JIT sync if modelId is known
    if (modelId) {
      try {
        const parentModel = await Model.findByPk(modelId, { transaction });
        if (parentModel && parentModel.external_id) {
          const detailRes = await fetchExternalJson(`${EXTERNAL_CATALOG_API}/models/${parentModel.external_id}`);
          const variants = detailRes && detailRes.data && detailRes.data.variants ? detailRes.data.variants : [];
          for (const extVar of variants) {
            if (!extVar || !extVar.version_id) continue;
            const versionId = parseInt(extVar.version_id, 10);
            const versionName = (extVar.version_name || `Variant ${versionId}`).trim();
            const fuelType = normalizeFuelType(extVar.fuel_type);
            const transmission = normalizeTransmission(extVar.transmission);

            let v = await Variant.findOne({
              where: {
                model_id: parentModel.id,
                [Op.or]: [
                  sequelize.where(fn('LOWER', col('name')), versionName.toLowerCase()),
                  { external_id: versionId },
                ],
              },
              transaction,
            });

            if (v) {
              if (v.external_id !== versionId) {
                await v.update({ external_id: versionId }, { transaction });
              }
            } else {
              v = await Variant.create({
                model_id: parentModel.id,
                name: versionName,
                external_id: versionId,
                fuel_type: fuelType,
                transmission: transmission,
                is_active: true,
              }, { transaction });
            }

            if (versionId === numericId) {
              variant = v;
            }
          }
          if (variant) return variant.id;
        }
      } catch (e) {
        console.warn(`JIT fetch for variant ${numericId} failed:`, e.message);
      }
    }

    throw new AppError(`Variant with external ID ${numericId} not found for this model.`, 404);
  }

  // 3. Lookup by name under modelId or create if not existing
  const where = {
    [Op.and]: [sequelize.where(fn('LOWER', col('name')), inputStr.toLowerCase())],
  };
  if (modelId) where.model_id = modelId;

  let variant = await Variant.findOne({ where, transaction });
  if (!variant) {
    if (!modelId) throw new AppError('Model is required to create a new variant.', 400);
    variant = await Variant.create(
      {
        name: inputStr,
        model_id: modelId,
        fuel_type: variantDefaults.fuel_type || null,
        transmission: variantDefaults.transmission || null,
        price: variantDefaults.price || null,
      },
      { transaction }
    );
  }
  return variant.id;
};

module.exports = {
  isUuid,
  fetchExternalJson,
  EXTERNAL_CATALOG_API,
  normalizeTransmission,
  normalizeFuelType,
  resolveBrandId,
  resolveModelId,
  resolveVariantId,
};
