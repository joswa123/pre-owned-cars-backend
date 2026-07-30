const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../../middlewares/auth');
const variantController = require('../../../controllers/variantController');

// All routes require authentication and admin role
router.use(protect, adminOnly);

router.post('/', variantController.createVariant);
router.post('/bulk', variantController.bulkCreateVariants);
router.put('/:id', variantController.updateVariant);
router.delete('/:id', variantController.deleteVariant);

module.exports = router;
