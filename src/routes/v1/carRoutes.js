// routes/v1/carRoutes.js
const express = require('express');
const router = express.Router();
const carController = require('../../controllers/carController');
const { protect } = require('../../middlewares/auth');
const { cacheMiddleware } = require('../../middlewares/cacheMiddleware');
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
    const hasPrimaryFile = req.files && req.files.primary_image && req.files.primary_image.length > 0;
    const hasSecondaryFiles = req.files && req.files.images && req.files.images.length > 0;
    const hasBodyImage = req.body && (req.body.primary_image || req.body.image_url || (Array.isArray(req.body.images) && req.body.images.length > 0));

    if (!hasPrimaryFile && !hasSecondaryFiles && !hasBodyImage) {
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

// ─── Mark Car as Sold ───────────────────────────────────────
router.patch('/:id/sell', protect, carController.markCarAsSold);

// ─── Delete Car ─────────────────────────────────────────────
router.delete('/:id', protect, carController.deleteCar);

// ─── Delete Car Image ───────────────────────────────────────
router.delete('/:id/images/:imageId', protect, carController.deleteCarImage);

// ─── Public Routes ──────────────────────────────────────────
const { optionalAuth } = require('../../middlewares/auth');
router.get('/', optionalAuth, cacheMiddleware(60), carController.getCars);
router.get('/stats/board-types', cacheMiddleware(300, { ignoreAuth: true }), carController.getBoardTypeStats); // must be BEFORE /:id
router.get('/featured', optionalAuth, cacheMiddleware(600), carController.getFeaturedCars); // must be BEFORE /:id

// Similar & Recommended Cars (Must be BEFORE /:id)
router.get('/similar-recommended', optionalAuth, carController.getSimilarRecommended);

router.get('/:id', optionalAuth, cacheMiddleware(300), carController.getCarById);

// Record view & interactions
router.get('/:id/view', optionalAuth, carController.recordView);
router.post('/:id/view', optionalAuth, carController.recordView);
router.post('/:id/interact', optionalAuth, carController.recordInteraction);

module.exports = router;