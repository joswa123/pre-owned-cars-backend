'use strict';

const brandService = require('../services/brandService');
const { brandSchema, brandUpdateSchema } = require('../validations/brandValidation');

/**
 * Public & Admin: Get all brands
 * GET /api/v1/admin/brands or GET /api/v1/catalog/brands
 */
exports.getAllBrands = async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    const includeInactive = req.query.include_inactive === 'true' && isAdmin;

    const brands = await brandService.getAllBrands({ includeInactive, isAdmin });
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

/**
 * Public & Admin: Get a single brand by ID, slug, or external ID
 * GET /api/v1/admin/brands/:id
 */
exports.getBrand = async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    const brand = await brandService.getBrandById(req.params.id, { isAdmin });
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

/**
 * Public & Admin: Get brands filtered by a specific vehicle type
 * GET /api/v1/types/:typeId/brands
 * GET /api/v1/admin/types/:typeId/brands
 */
exports.getBrandsByType = async (req, res, next) => {
  try {
    const { typeId } = req.params;
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    const includeInactive = req.query.include_inactive === 'true' && isAdmin;

    const brands = await brandService.getBrandsByType(typeId, {
      isAdmin,
      includeInactive,
    });

    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a brand linked to vehicle type(s)
 * POST /api/v1/admin/brands
 */
exports.createBrand = async (req, res, next) => {
  try {
    const { error, value } = brandSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const logoFile = req.file || null;
    const brand = await brandService.createBrand(value, logoFile);

    res.status(201).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update a brand
 * PUT /api/v1/admin/brands/:id
 */
exports.updateBrand = async (req, res, next) => {
  try {
    const { error, value } = brandUpdateSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const brand = await brandService.updateBrand(req.params.id, value, req.file || null);

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a brand (Soft delete if active cars exist)
 * DELETE /api/v1/admin/brands/:id
 */
exports.deleteBrand = async (req, res, next) => {
  try {
    const result = await brandService.deleteBrand(req.params.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};