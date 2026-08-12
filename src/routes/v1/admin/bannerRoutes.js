const express = require('express');
const bannerController = require('../../../controllers/bannerController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const { createBannerSchema, updateBannerSchema, reorderBannerSchema } = require('../../../validations/bannerValidation');
const { bannerUpload } = require('../../../middlewares/upload');

const router = express.Router();

// All routes require admin role
router.use(protect, adminOnly);

router.get('/', bannerController.getAllBanners);
router.post('/reorder', validate(reorderBannerSchema), bannerController.reorderBanners);
router.post('/', bannerUpload.single('image'), validate(createBannerSchema), bannerController.createBanner);
router.put('/:id', bannerUpload.single('image'), validate(updateBannerSchema), bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
