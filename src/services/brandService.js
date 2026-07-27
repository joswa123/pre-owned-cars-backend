const { Brand } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database'); 

exports.getAllBrands = async () => {
  return await Brand.findAll({ order: [['name', 'ASC']] });
};

exports.getBrandById = async (id) => {
  const brand = await Brand.findByPk(id);
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