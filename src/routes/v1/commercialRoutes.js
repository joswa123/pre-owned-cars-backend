const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const commercialVehicleController = require('../../controllers/commercialVehicleController');
const { protect, optionalAuth } = require('../../middlewares/auth');
const { commercialMediaUpload, uploadVideo, uploadAudio } = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const {
  createCommercialVehicleSchema,
  updateCommercialVehicleSchema,
} = require('../../validations/commercialValidation');

/**
 * Pre-validation middleware for commercial vehicle images:
 * Ensures at least one primary image is provided via file or body URL.
 */
const validateCommercialImages = (req, res, next) => {
  const hasPrimaryFile = req.files && req.files.primary_image && req.files.primary_image.length > 0;
  const hasSecondaryFiles =
    (req.files && req.files.secondary_images && req.files.secondary_images.length > 0) ||
    (req.files && req.files.images && req.files.images.length > 0);
  const hasBodyImage =
    req.body &&
    (req.body.primary_image ||
      (Array.isArray(req.body.secondary_images) && req.body.secondary_images.length > 0) ||
      (Array.isArray(req.body.images) && req.body.images.length > 0));

  if (!hasPrimaryFile && !hasSecondaryFiles && !hasBodyImage) {
    return res.status(400).json({ success: false, message: 'Primary image is required.' });
  }

  const isInvalidUrl = (url) =>
    typeof url === 'string' && url.trim() !== '' && !url.startsWith('https://res.cloudinary.com/');

  if (isInvalidUrl(req.body?.primary_image)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid primary image URL. All image URLs must start with https://res.cloudinary.com/',
    });
  }

  next();
};

// ─── Create Commercial Vehicle ──────────────────────────────────
router.post(
  '/',
  protect,
  (req, res, next) => {
    req.commercialVehicleId = req.body?.commercial_vehicle_id || crypto.randomUUID();
    next();
  },
  commercialMediaUpload,
  validateCommercialImages,
  validate(createCommercialVehicleSchema),
  commercialVehicleController.createCommercialVehicle
);

// ─── Public Commercial Vehicles List ────────────────────────────
router.get('/', optionalAuth, commercialVehicleController.getCommercialVehicles);

// ─── Get Current Seller's Commercial Vehicles (MUST BE BEFORE /:id) ──
router.get('/me', protect, commercialVehicleController.getUserCommercialVehicles);

// ─── Similar & Recommended Commercial Vehicles (MUST BE BEFORE /:id) ──
router.get('/similar-recommended', optionalAuth, commercialVehicleController.getSimilarRecommended);
router.get('/recommended', optionalAuth, commercialVehicleController.getRecommended);

// ─── Public Seller Commercial Listings (MUST BE BEFORE /:id) ──
router.get('/seller/:sellerId', optionalAuth, commercialVehicleController.getSellerListings);
router.get('/user/:userId', optionalAuth, commercialVehicleController.getSellerListings);

// ─── Single Commercial Vehicle Sub-resources & Detail ──────────
router.get('/:id/similar-recommended', optionalAuth, commercialVehicleController.getSimilarRecommended);
router.get('/:id/similar', optionalAuth, commercialVehicleController.getSimilarVehicles);
router.get('/:id/recommended', optionalAuth, commercialVehicleController.getRecommended);

// ─── Single Commercial Vehicle by ID or Slug ────────────────────
router.get('/:id', optionalAuth, commercialVehicleController.getCommercialVehicleById);

// ─── Update Commercial Vehicle ──────────────────────────────────
router.patch(
  '/:id',
  protect,
  (req, res, next) => {
    req.commercialVehicleId = req.params.id;
    next();
  },
  commercialMediaUpload,
  validate(updateCommercialVehicleSchema),
  commercialVehicleController.updateCommercialVehicle
);

router.put(
  '/:id',
  protect,
  (req, res, next) => {
    req.commercialVehicleId = req.params.id;
    next();
  },
  commercialMediaUpload,
  validate(updateCommercialVehicleSchema),
  commercialVehicleController.updateCommercialVehicle
);

// ─── Mark Commercial Vehicle as Sold ────────────────────────────
router.patch('/:id/sell', protect, commercialVehicleController.markAsSold);

// ─── Delete Commercial Vehicle (Soft Delete) ───────────────────
router.delete('/:id', protect, commercialVehicleController.deleteCommercialVehicle);

// ─── Image Sub-resources ────────────────────────────────────────
router.post(
  '/:id/images',
  protect,
  (req, res, next) => {
    req.commercialVehicleId = req.params.id;
    next();
  },
  commercialMediaUpload,
  commercialVehicleController.addImages
);

router.delete('/:id/images/:imageId', protect, commercialVehicleController.deleteImage);

router.patch('/:id/images/:imageId/primary', protect, commercialVehicleController.setPrimaryImage);

// ─── Video & Audio Sub-resources ────────────────────────────────
router.post(
  '/:id/video',
  protect,
  (req, res, next) => {
    req.commercialVehicleId = req.params.id;
    next();
  },
  uploadVideo,
  commercialVehicleController.uploadVideo
);

router.post(
  '/:id/audio',
  protect,
  (req, res, next) => {
    req.commercialVehicleId = req.params.id;
    next();
  },
  uploadAudio,
  commercialVehicleController.uploadAudio
);

module.exports = router;

