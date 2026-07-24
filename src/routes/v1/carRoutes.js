// routes/v1/carRoutes.js
const express = require('express');
const router = express.Router();
const carController = require('../../controllers/carController');
const { protect } = require('../../middlewares/auth');
const { carUpload } = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const { createCarSchema, updateCarSchema } = require('../../validations/carValidation');

// ─── Create Car ─────────────────────────────────────────────
router.post(
  '/',
  protect,
  carUpload.fields([
    { name: 'primary_image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  (req, res, next) => {
    console.log('📝 req.body:', req.body);
    console.log('📁 req.files:', req.files);
    next();
  },
  (req, res, next) => {
    if (!req.files || !req.files.primary_image || req.files.primary_image.length === 0) {
      return res.status(400).json({ success: false, message: 'Primary image is required.' });
    }
    next();
  },
  validate(createCarSchema),
  carController.createCar
);


// ─── Get Seller's Cars ──────────────────────────────────────
router.get('/me', protect, carController.getUserCars);

// ─── Update Car ─────────────────────────────────────────────
router.put('/:id', protect, carUpload.fields([
    { name: 'primary_image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),validate(updateCarSchema), carController.updateCar);

// ─── Delete Car ─────────────────────────────────────────────
router.delete('/:id', protect, carController.deleteCar);

// ─── Public Routes ──────────────────────────────────────────
router.get('/', carController.getCars);
router.get('/featured', carController.getFeaturedCars); // must be BEFORE /:id
router.get('/:id', carController.getCarById);
module.exports = router;