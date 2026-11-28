const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bikeController = require('../../controllers/bikeController');
const { protect, optionalAuth } = require('../../middlewares/auth');
const { bikeMediaUpload, uploadVideo, uploadAudio } = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const {
  createBikeSchema,
  updateBikeSchema,
} = require('../../validations/bikeValidation');

/**
 * Pre-validation middleware for bike images:
 * Ensures at least one valid image is provided via file or body URL.
 */
const validateBikeImages = (req, res, next) => {
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

// ─── Create Bike Listing ────────────────────────────────────────
router.post(
  '/',
  protect,
  (req, res, next) => {
    req.bikeId = req.body?.bike_id || crypto.randomUUID();
    next();
  },
  bikeMediaUpload,
  validateBikeImages,
  validate(createBikeSchema),
  bikeController.createBike
);

// ─── Public Bike Listings List ──────────────────────────────────
router.get('/', optionalAuth, bikeController.getBikes);

// ─── Bike Catalog: Types, Brands, & Models (MUST BE BEFORE /:id) ─
router.get('/vehicle-types', bikeController.getBikeTypes);
router.get('/types', bikeController.getBikeTypes);
router.get('/brands', bikeController.getBikeBrands);
router.get('/vehicle-types/:vehicleTypeId/brands', bikeController.getBikeBrands);
router.get('/types/:typeId/brands', bikeController.getBikeBrands);
router.get('/brands/:brandId/models', bikeController.getBikeModels);

// ─── Current Seller's Bikes (MUST BE BEFORE /:id) ────────────────
router.get('/me', protect, bikeController.getUserBikes);

// ─── Similar & Recommended Bikes (MUST BE BEFORE /:id) ───────────
router.get('/similar-recommended', optionalAuth, bikeController.getSimilarRecommended);
router.get('/recommended', optionalAuth, bikeController.getRecommended);

// ─── Public Seller Bike Listings (MUST BE BEFORE /:id) ───────────
router.get('/seller/:sellerId', optionalAuth, bikeController.getSellerListings);
router.get('/user/:userId', optionalAuth, bikeController.getSellerListings);

// ─── Single Bike Sub-resources & Detail ─────────────────────────
router.get('/:id/similar-recommended', optionalAuth, bikeController.getSimilarRecommended);
router.get('/:id/similar', optionalAuth, bikeController.getSimilarBikes);
router.get('/:id/recommended', optionalAuth, bikeController.getRecommended);

router.get('/:id', optionalAuth, bikeController.getBikeById);

// ─── Views & Direct Enquiries ───────────────────────────────────
router.get('/:id/view', optionalAuth, bikeController.recordView);
router.post('/:id/view', optionalAuth, bikeController.recordView);
router.post('/:id/enquire', protect, bikeController.enquire);
router.post('/:id/interact', protect, bikeController.enquire);

// ─── Update Bike Listing ────────────────────────────────────────
router.patch(
  '/:id',
  protect,
  (req, res, next) => {
    req.bikeId = req.params.id;
    next();
  },
  bikeMediaUpload,
  validate(updateBikeSchema),
  bikeController.updateBike
);

router.put(
  '/:id',
  protect,
  (req, res, next) => {
    req.bikeId = req.params.id;
    next();
  },
  bikeMediaUpload,
  validate(updateBikeSchema),
  bikeController.updateBike
);

// ─── Mark Bike as Sold / Delete ─────────────────────────────────
router.patch('/:id/sell', protect, bikeController.markAsSold);
router.delete('/:id', protect, bikeController.deleteBike);

// ─── Image Sub-resources (up to 12 photos) ──────────────────────
router.post(
  '/:id/images',
  protect,
  (req, res, next) => {
    req.bikeId = req.params.id;
    next();
  },
  bikeMediaUpload,
  bikeController.addImages
);

router.delete('/:id/images/:imageId', protect, bikeController.deleteImage);
router.patch('/:id/images/:imageId/primary', protect, bikeController.setPrimaryImage);

// ─── Video & Audio Sub-resources ────────────────────────────────
router.post(
  '/:id/video',
  protect,
  (req, res, next) => {
    req.bikeId = req.params.id;
    next();
  },
  uploadVideo,
  bikeController.uploadVideo
);

router.post(
  '/:id/audio',
  protect,
  (req, res, next) => {
    req.bikeId = req.params.id;
    next();
  },
  uploadAudio,
  bikeController.uploadAudio
);

module.exports = router;
