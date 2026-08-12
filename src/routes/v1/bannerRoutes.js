const express = require('express');
const bannerController = require('../../controllers/bannerController');

const router = express.Router();

router.get('/', bannerController.getActiveBanners);

module.exports = router;
