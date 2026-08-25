const express = require('express');
const router = express.Router();
const catalogController = require('../../controllers/catalogController');
const brandController = require('../../controllers/brandController');
const { protect, adminOnly } = require('../../middlewares/auth');
const { brandUpload } = require('../../middlewares/upload');
const multer = require('multer');

const handleUpload = (req, res, next) => {
  brandUpload.single('logo')(req, res, (err) => {
    if (err instanceof multer.MulterError || err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

const { cacheMiddleware } = require('../../middlewares/cacheMiddleware');

// Public Catalog Routes
router.get('/brands', cacheMiddleware(60, { ignoreAuth: true }), catalogController.getBrands);
router.get('/brands/:brandId/models', cacheMiddleware(3600, { ignoreAuth: true }), catalogController.getModelsByBrand);
router.get('/models/:modelId/variants', cacheMiddleware(3600, { ignoreAuth: true }), catalogController.getVariantsByModel);
router.get('/search', catalogController.searchCatalog);

// Protected Admin Routes for Catalog Management
router.post('/brands', protect, adminOnly, handleUpload, brandController.createBrand);
router.post('/sync', protect, adminOnly, catalogController.triggerSync);

module.exports = router;
