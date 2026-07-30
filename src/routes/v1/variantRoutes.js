const express = require('express');
const router = express.Router();
const variantController = require('../../controllers/variantController');

router.get('/', variantController.getAllVariants);
router.get('/:id', variantController.getVariant);

module.exports = router;
