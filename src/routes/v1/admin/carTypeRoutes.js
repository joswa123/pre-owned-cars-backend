'use strict';

const express = require('express');
const router = express.Router();
const carTypeController = require('../../../controllers/carTypeController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const {
  createCarTypeSchema,
  updateCarTypeSchema,
} = require('../../../validations/carTypeValidation');
const { categoryUpload } = require('../../../middlewares/upload');

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

// Admin Category / CarType Management Endpoints
router.get('/', carTypeController.getAllCarTypes);
router.get('/:id', carTypeController.getCarType);
router.post(
  '/',
  categoryUpload,
  validate(createCarTypeSchema, { allowUnknown: false }),
  carTypeController.createCarType
);
router.put(
  '/:id',
  categoryUpload,
  validate(updateCarTypeSchema, { allowUnknown: false }),
  carTypeController.updateCarType
);
router.delete('/:id', carTypeController.deleteCarType);

module.exports = router;
