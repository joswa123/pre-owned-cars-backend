const { Brand } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const getUploadsDir = () => {
  return isVercel ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '..', '..', 'uploads');
};

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

  const logoPath = logoFile ? logoFile.filename : null;

  const brand = await Brand.create({
    name: data.name,
    logo: logoPath,
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
    if (brand.logo) {
      const oldPath = path.join(getUploadsDir(), 'brands', brand.logo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    updateData.logo = logoFile.filename;
  }
  await brand.update(updateData);
  return brand;
};

exports.deleteBrand = async (id) => {
  const brand = await Brand.findByPk(id);
  if (!brand) throw new Error('Brand not found');
  
  if (brand.logo) {
    const oldPath = path.join(getUploadsDir(), 'brands', brand.logo);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  
  await brand.destroy();
  return { message: 'Brand deleted' };
};