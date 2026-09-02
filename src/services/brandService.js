const { Brand, Car } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');

exports.getBrandsWithCarCounts = async () => {
  const cacheKey = 'brands:with_counts';
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error('Redis get error', e);
  }

  const brands = await Brand.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  const counts = await Car.findAll({
    attributes: [
      'brand_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: { status: 'active' },
    group: ['brand_id']
  });

  const countMap = {};
  counts.forEach(c => { countMap[c.brand_id] = parseInt(c.get('count')); });

  const result = brands.map(b => ({
    ...b.toJSON(),
    car_count: countMap[b.id] || 0
  }));

  try {
    await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
  } catch (e) {
    console.error('Redis setEx error', e);
  }
  
  return result;
};

exports.getAllBrands = async () => {
  return await Brand.findAll({ order: [['name', 'ASC']] });
};

exports.getBrandById = async (id) => {
  const idStr = String(id).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
  let brand = null;
  if (isUuid) {
    brand = await Brand.findByPk(idStr);
  } else if (/^\d+$/.test(idStr)) {
    brand = await Brand.findOne({ where: { external_id: parseInt(idStr, 10) } });
  }
  if (!brand) throw new Error('Brand not found');
  return brand;
};

/**
 * Create a new brand.
 * @param {Object} data - { name }
 * @param {Object} logoFile - Multer file object (with `path` = Cloudinary URL)
 */
exports.createBrand = async (data, logoFile) => {
  // Check if brand already exists
  const normalizedName = data.name.trim().toLowerCase();

  const existing = await Brand.findOne({
    where: {
      name: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        normalizedName
      )
    }
  });
  if (existing) throw new Error('Brand name already exists');

  // Store the Cloudinary URL (or local file path) if provided
  const logoUrl = logoFile ? logoFile.path : null;

  const brand = await Brand.create({
    name: data.name,
    logo: logoUrl, // ⬅️ now stores the full URL
  });
  return brand;
};

/**
 * Update an existing brand.
 * @param {string} id - Brand UUID
 * @param {Object} data - { name } (optional)
 * @param {Object} logoFile - Multer file object (optional)
 */
exports.updateBrand = async (id, data, logoFile) => {
  const brand = await Brand.findByPk(id);
  if (!brand) throw new Error('Brand not found');

  // Check name uniqueness if changed
  if (data.name && data.name !== brand.name) {
    const existing = await Brand.findOne({ where: { name: data.name } });
    if (existing) throw new Error('Brand name already exists');
  }

  const updateData = { name: data.name || brand.name };

  // If a new logo is uploaded, update the logo URL
  if (logoFile) {
    // 💡 Optional: delete old logo from Cloudinary here if needed
    // (requires cloudinary.uploader.destroy)
    updateData.logo = logoFile.path; // ⬅️ store the new URL
  }

  await brand.update(updateData);
  return brand;
};

/**
 * Delete a brand.
 * @param {string} id - Brand UUID
 */
exports.deleteBrand = async (id) => {
  const brand = await Brand.findByPk(id);
  if (!brand) throw new Error('Brand not found');

  // 💡 Optional: delete logo from Cloudinary here if needed
  // if (brand.logo) {
  //   const publicId = brand.logo.split('/').pop().split('.')[0];
  //   await cloudinary.uploader.destroy(publicId);
  // }

  await brand.destroy();
  return { message: 'Brand deleted' };
};