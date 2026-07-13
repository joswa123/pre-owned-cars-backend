const express = require('express');
const router = express.Router();
const fuelTypeController = require('../../controllers/fuelTypeController');

// Public GET endpoints – no auth
router.get('/', fuelTypeController.getAllFuelTypes);
router.get('/:fuel_type_id', fuelTypeController.getFuelType);

module.exports = router;