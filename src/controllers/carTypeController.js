'use strict';

const carTypeService = require('../services/carTypeService');

/**
 * Public: Get all active car types / categories
 * GET /api/v1/car-types
 */
exports.getAllCarTypes = async (req, res, next) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const includeInactive = req.query.include_inactive === 'true' && isAdmin;

    const carTypes = await carTypeService.getAllCarTypes({
      includeInactive,
      isAdmin,
    });

    res.status(200).json({
      success: true,
      data: carTypes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get single car type by UUID, slug, or identifier
 * GET /api/v1/car-types/:id
 */
exports.getCarType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user && req.user.role === 'admin';

    const carType = await carTypeService.getCarTypeByIdentifier(id, { isAdmin });

    res.status(200).json({
      success: true,
      data: carType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new car type / category
 * POST /api/v1/admin/car-types
 */
exports.createCarType = async (req, res, next) => {
  try {
    const newCarType = await carTypeService.createCarType(
      req.body,
      req.file || null,
      req.user || null
    );

    res.status(201).json({
      success: true,
      data: newCarType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update an existing car type / category
 * PUT /api/v1/admin/car-types/:id
 */
exports.updateCarType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await carTypeService.updateCarType(
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
 * Admin: Delete a car type / category
 * DELETE /api/v1/admin/car-types/:id
 */
exports.deleteCarType = async (req, res, next) => {
  try {
    const { id } = req.params;
    await carTypeService.deleteCarType(id, req.user || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};