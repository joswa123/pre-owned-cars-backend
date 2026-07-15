const express = require('express');
const router = express.Router();
const brandController = require('../../controllers/brandController');

// Public – anyone can view brands
router.get('/', brandController.getAllBrands);
router.get('/:id', brandController.getBrand);

module.exports = router;