'use strict';

const express = require('express');
const router = express.Router();
const vehicleTypeController = require('../../controllers/vehicleTypeController');
const brandController = require('../../controllers/brandController');
const { cacheMiddleware } = require('../../middlewares/cacheMiddleware');

// Public Vehicle Types Endpoints
// Cache 300s (5 minutes)
router.get('/', cacheMiddleware(300, { ignoreAuth: true }), vehicleTypeController.getAllVehicleTypes);
router.get('/:typeId/brands', cacheMiddleware(300, { ignoreAuth: true }), brandController.getBrandsByType);
router.get('/:id', cacheMiddleware(300, { ignoreAuth: true }), vehicleTypeController.getVehicleType);

module.exports = router;
