const express = require('express');
const router = express.Router();
const carController = require('../../controllers/carController');
const { protect } = require('../../middlewares/auth');
const { uploadImages } = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const { carSchema } = require('../../validations/carValidation');

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', carController.getCars);

// IMPORTANT: /my/listings MUST come before /:id to avoid Express matching
// "my" as a car ID parameter.
// Apply protect middleware explicitly on this route.
router.get('/my/listings', protect, carController.getUserCars);

router.get('/:id', carController.getCarById);

// ── Protected routes (require authentication) ────────────────────────────────
router.post('/', protect, uploadImages, validate(carSchema), carController.createCar);
router.put('/:id', protect, validate(carSchema), carController.updateCar);
router.delete('/:id', protect, carController.deleteCar);

module.exports = router;