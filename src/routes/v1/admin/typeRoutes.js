'use strict';

const express = require('express');
const router = express.Router();
const vehicleTypeController = require('../../../controllers/vehicleTypeController');
const brandController = require('../../../controllers/brandController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const {
  createVehicleTypeSchema,
  updateVehicleTypeSchema,
} = require('../../../validations/vehicleTypeValidation');
const { categoryUpload } = require('../../../middlewares/upload');

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

// Admin Vehicle Type Management Endpoints
router.get('/', vehicleTypeController.getAllVehicleTypes);
router.get('/:typeId/brands', brandController.getBrandsByType);
router.get('/:id', vehicleTypeController.getVehicleType);
router.post(
  '/',
  categoryUpload,
  validate(createVehicleTypeSchema, { allowUnknown: false }),
  vehicleTypeController.createVehicleType
);
router.put(
  '/:id',
  categoryUpload,
  validate(updateVehicleTypeSchema, { allowUnknown: false }),
  vehicleTypeController.updateVehicleType
);
router.delete('/:id', vehicleTypeController.deleteVehicleType);

module.exports = router;
