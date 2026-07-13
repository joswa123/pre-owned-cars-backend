const { Brand } = require('../models');
const { Op } = require('sequelize');

exports.getAllBrands = async () => {
  return await Brand.findAll({ order: [['name', 'ASC']] });
};

exports.getBrandById = async (id) => {
  const brand = await Brand.findByPk(id);
  if (!brand) throw new Error('Brand not found');
  return brand;
};

exports.createBrand = async (data, logoFile) => {
  const existing = await Brand.findOne({ where: { name: data.name } });
  if (existing) throw new Error('Brand name already exists');
console.log('BODY:', req.body);
  console.log('FILE:', req.file);
  const brand = await Brand.create({
    name: data.name,
    logo: logoFile ? logoFile.filename : null,
  });
  return brand;
};

exports.updateBrand = async (id, data, logoFile) => {
  const brand = await Brand.findByPk(id);
  if (!brand) throw new Error('Brand not found');

  if (data.name && data.name !== brand.name) {
    const existing = await Brand.findOne({ where: { name: data.name } });
    if (existing) throw new Error('Brand name already exists');
  }

  const updateData = { name: data.name || brand.name };
  if (logoFile) {
    // Optionally delete old logo file here
    updateData.logo = logoFile.filename;
  }
  await brand.update(updateData);
  return brand;
};

exports.deleteBrand = async (id) => {
  const brand = await Brand.findByPk(id);
  if (!brand) throw new Error('Brand not found');
  // Optionally delete logo file from disk
  await brand.destroy();
  return { message: 'Brand deleted' };
};