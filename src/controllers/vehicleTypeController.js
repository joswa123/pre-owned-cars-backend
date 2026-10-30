'use strict';

const vehicleTypeService = require('../services/vehicleTypeService');

/**
 * Public & Admin: Get all vehicle types
 * GET /api/v1/types
 * GET /api/v1/admin/types
 */
exports.getAllVehicleTypes = async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    const includeInactive = req.query.include_inactive === 'true' && isAdmin;
    const categoryId = req.query.category_id || null;
    const categorySlug = req.query.category || null;

    const types = await vehicleTypeService.getAllVehicleTypes({
      includeInactive,
      isAdmin,
      categoryId,
      categorySlug,
    });

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public & Admin: Get a single vehicle type by ID or slug
 * GET /api/v1/types/:id
 * GET /api/v1/admin/types/:id
 */
exports.getVehicleType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = Boolean(req.user && req.user.role === 'admin');

    const vehicleType = await vehicleTypeService.getVehicleTypeByIdentifier(id, { isAdmin });

    res.status(200).json({
      success: true,
      data: vehicleType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new vehicle type
 * POST /api/v1/admin/types
 */
exports.createVehicleType = async (req, res, next) => {
  try {
    const newVehicleType = await vehicleTypeService.createVehicleType(
      req.body,
      req.file || null,
      req.user || null
    );

    res.status(201).json({
      success: true,
      data: newVehicleType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update a vehicle type
 * PUT /api/v1/admin/types/:id
 */
exports.updateVehicleType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await vehicleTypeService.updateVehicleType(
      id,
      req.body,
      req.file || null,
      req.user || null
    );

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a vehicle type (with soft-delete protection)
 * DELETE /api/v1/admin/types/:id
 */
exports.deleteVehicleType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await vehicleTypeService.deleteVehicleType(id, req.user || null);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
