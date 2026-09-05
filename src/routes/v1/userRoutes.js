const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { protect, optionalAuth } = require('../../middlewares/auth');
const carController = require('../../controllers/carController');
const validate = require('../../middlewares/validate');
const { updateProfileSchema } = require('../../validations/userValidation');
const upload = require('../../middlewares/profileUploads');

const dashboardController = require('../../controllers/dashboardController');

// User listings & cars for current user
router.get('/me/listings', protect, carController.getUserCars);
router.get('/me/cars', protect, carController.getUserCars);

// Public listings route for specific seller
router.get('/:userId/listings', optionalAuth, userController.getSellerListings);

// Protected routes
router.use(protect);

router.get('/me/dashboard', dashboardController.getDashboardSummary);
router.get('/me', userController.getProfile);
router.put(
  '/me',
  upload.fields([
    { name: 'profile_picture', maxCount: 1 },
    { name: 'customerProfile', maxCount: 1 },
    { name: 'dealerProfile', maxCount: 1 },
  ]),
  validate(updateProfileSchema),
  userController.updateProfile
);

module.exports = router;