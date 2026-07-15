const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../../middlewares/auth');
const fuelTypeController = require('../../../controllers/fuelTypeController');

// All routes require authentication and admin role
router.use(protect, adminOnly);

router.post('/', fuelTypeController.createFuelType);
router.put('/:fuel_type_id', fuelTypeController.updateFuelType);
router.patch('/:fuel_type_id/status', fuelTypeController.updateFuelTypeStatus);
router.delete('/:fuel_type_id', fuelTypeController.deleteFuelType);

module.exports = router;