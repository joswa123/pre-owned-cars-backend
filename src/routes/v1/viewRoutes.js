const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const viewController = require('../../controllers/viewController');

// All routes require authentication
router.get('/car/:carId', protect, viewController.getCarViews);

module.exports = router;
