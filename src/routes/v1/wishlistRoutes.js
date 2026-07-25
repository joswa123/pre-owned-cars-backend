const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const wishlistController = require('../../controllers/wishlistController');

// All routes require authentication
router.use(protect);

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.delete('/:carId', wishlistController.removeFromWishlist);

module.exports = router;