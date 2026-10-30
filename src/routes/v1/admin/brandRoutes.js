'use strict';

const express = require('express');
const router = express.Router();
const brandController = require('../../../controllers/brandController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const { brandUpload } = require('../../../middlewares/upload');

// All admin routes require authentication and admin role
router.use(protect, adminOnly);

// Admin Brand Management Endpoints
router.get('/', brandController.getAllBrands);
router.get('/:id', brandController.getBrand);
router.post('/', brandUpload, brandController.createBrand);
router.put('/:id', brandUpload, brandController.updateBrand);
router.delete('/:id', brandController.deleteBrand);

module.exports = router;
