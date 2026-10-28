'use strict';

const categoryService = require('../services/categoryService');

/**
 * Public: Get all active categories
 * GET /api/v1/categories
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const includeInactive = req.query.include_inactive === 'true' && isAdmin;

    const categories = await categoryService.getAllCategories({
      includeInactive,
      isAdmin,
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get single category by UUID or slug
 * GET /api/v1/categories/:id
 */
exports.getCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user && req.user.role === 'admin';

    const category = await categoryService.getCategoryByIdentifier(id, { isAdmin });

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new category
 * POST /api/v1/admin/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const newCategory = await categoryService.createCategory(
      req.body,
      req.file || null,
      req.user || null
    );

    res.status(201).json({
      success: true,
      data: newCategory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update an existing category
 * PUT /api/v1/admin/categories/:id
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await categoryService.updateCategory(
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
 * Admin: Delete a category
 * DELETE /api/v1/admin/categories/:id
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await categoryService.deleteCategory(id, req.user || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
