const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const viewController = require('../../controllers/viewController');

// All routes require authentication
router.get('/car/:carId', protect, viewController.getCarViews);
router.get('/commercial/:id', protect, viewController.getCommercialViews);
router.get('/commercial/:carId', protect, viewController.getCommercialViews);
router.get('/vehicle/:id', protect, viewController.getCarViews);
router.get('/vehicle/:carId', protect, viewController.getCarViews);

module.exports = router;
