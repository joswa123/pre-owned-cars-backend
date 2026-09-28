// routes/v1/carRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const carController = require('../../controllers/carController');
const { protect } = require('../../middlewares/auth');
const { cacheMiddleware } = require('../../middlewares/cacheMiddleware');
const { carMediaUpload, uploadVideo } = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const { createCarSchema, updateCarSchema } = require('../../validations/carValidation');

/**
 * Pre-validation middleware for car images:
 * 1. Checks that at least one image is provided (file or body).
 * 2. Enforces that any image URL passed in body starts with https://res.cloudinary.com/.
 */
const validateCarImages = (req, res, next) => {
  const hasPrimaryFile = req.files && req.files.primary_image && req.files.primary_image.length > 0;
  const hasSecondaryFiles = req.files && req.files.images && req.files.images.length > 0;
  const hasBodyImage = req.body && (req.body.primary_image || req.body.image_url || (Array.isArray(req.body.images) && req.body.images.length > 0));

  if (!hasPrimaryFile && !hasSecondaryFiles && !hasBodyImage) {
    return res.status(400).json({ success: false, message: 'Primary image is required.' });
  }

  // Pre-save validation: Reject any image URL not starting with https://res.cloudinary.com/
  const isInvalidUrl = (url) => {
    return typeof url === 'string' && url.trim() !== '' && !url.startsWith('https://res.cloudinary.com/');
  };

  if (isInvalidUrl(req.body?.primary_image)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid primary image URL. All image URLs must start with https://res.cloudinary.com/',
    });
  }

  if (isInvalidUrl(req.body?.image_url)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image URL. All image URLs must start with https://res.cloudinary.com/',
    });
  }

  if (Array.isArray(req.body?.images)) {
    for (const img of req.body.images) {
      const url = typeof img === 'string' ? img : img?.image_url;
      if (isInvalidUrl(url)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image URL in images array. All image URLs must start with https://res.cloudinary.com/',
        });
      }
    }
  }

  next();
};

// ─── Create Car ─────────────────────────────────────────────
router.post(
  '/',
  protect,
  (req, res, next) => {
    // Generate carId early so Cloudinary uploads stream directly to autodeal4u/cars/{carId}/
    req.carId = req.body?.car_id || crypto.randomUUID();
    next();
  },
  carMediaUpload,
  validateCarImages,
  validate(createCarSchema),
  carController.createCar
);

// ─── Get Seller's Cars ──────────────────────────────────────
router.get('/me', protect, carController.getUserCars);

// ─── Update Car ─────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  (req, res, next) => {
    req.carId = req.params.id;
    next();
  },
  carMediaUpload,
  (req, res, next) => {
    const isInvalidUrl = (url) => typeof url === 'string' && url.trim() !== '' && !url.startsWith('https://res.cloudinary.com/');
    if (isInvalidUrl(req.body?.primary_image) || isInvalidUrl(req.body?.image_url)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image URL. All image URLs must start with https://res.cloudinary.com/',
      });
    }
    if (Array.isArray(req.body?.images)) {
      for (const img of req.body.images) {
        const url = typeof img === 'string' ? img : img?.image_url;
        if (isInvalidUrl(url)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image URL. All image URLs must start with https://res.cloudinary.com/',
          });
        }
      }
    }
    next();
  },
  validate(updateCarSchema),
  carController.updateCar
);

// ─── Mark Car as Sold ───────────────────────────────────────
router.patch('/:id/sell', protect, carController.markCarAsSold);

// ─── Delete Car ─────────────────────────────────────────────
router.delete('/:id', protect, carController.deleteCar);

// ─── Delete Car Image ───────────────────────────────────────
router.delete('/:id/images/:imageId', protect, carController.deleteCarImage);

// ─── Upload Car Video ───────────────────────────────────────
router.post('/:id/video', protect, uploadVideo, carController.uploadCarVideo);

// ─── Public Routes ──────────────────────────────────────────
const { optionalAuth } = require('../../middlewares/auth');
router.get('/', optionalAuth, cacheMiddleware(60), carController.getCars);
router.get('/stats/board-types', cacheMiddleware(60, { ignoreAuth: true }), carController.getBoardTypeStats); // must be BEFORE /:id
router.get('/featured', optionalAuth, cacheMiddleware(600), carController.getFeaturedCars); // must be BEFORE /:id

// Media URLs (video & audio) are included in the car detail response (GET /:id) – no separate endpoints needed
// Similar & Recommended Cars (Must be BEFORE /:id)
router.get('/similar-recommended', optionalAuth, carController.getSimilarRecommended);

router.get('/:id', optionalAuth, cacheMiddleware(300), carController.getCarById);

// Record view & interactions
router.get('/:id/view', optionalAuth, carController.recordView);
router.post('/:id/view', optionalAuth, carController.recordView);
router.post('/:id/interact', optionalAuth, carController.recordInteraction);

module.exports = router;