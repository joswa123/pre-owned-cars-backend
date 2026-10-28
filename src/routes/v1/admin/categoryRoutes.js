'use strict';

const express = require('express');
const router = express.Router();
const categoryController = require('../../../controllers/categoryController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../../../validations/categoryValidation');
const { categoryUpload } = require('../../../middlewares/upload');

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

// Admin Category Management Endpoints
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);
router.post(
  '/',
  categoryUpload,
  validate(createCategorySchema, { allowUnknown: false }),
  categoryController.createCategory
);
router.put(
  '/:id',
  categoryUpload,
  validate(updateCategorySchema, { allowUnknown: false }),
  categoryController.updateCategory
);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
