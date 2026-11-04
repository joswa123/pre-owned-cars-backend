const express = require('express');
const router = express.Router();
const searchController = require('../../controllers/searchController');
const { optionalAuth } = require('../../middlewares/auth');

router.get('/', optionalAuth, searchController.search);

module.exports = router;

