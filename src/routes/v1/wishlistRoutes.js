const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const wishlistController = require('../../controllers/wishlistController');
const { wishlistWriteSchema } = require('../../validations/wishlistValidation');

// All routes require authentication
router.use(protect);

router.get('/', wishlistController.getWishlist);
router.get('/car/:carId', wishlistController.getCarWishlists);
router.get('/commercial/:commercialId', wishlistController.getCommercialWishlists);
router.post('/', validate(wishlistWriteSchema), wishlistController.addToWishlist);
router.post('/toggle', validate(wishlistWriteSchema), wishlistController.toggleWishlist);
router.delete('/commercial/:commercialId', wishlistController.removeFromWishlist);
router.delete('/car/:carId', wishlistController.removeFromWishlist);
router.delete('/:id', wishlistController.removeFromWishlist);
router.delete('/', wishlistController.removeFromWishlist);

module.exports = router;