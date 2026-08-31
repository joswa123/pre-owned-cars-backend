const express = require('express');
const router = express.Router();
const highlightController = require('../../controllers/highlightController');

// Public: Get active highlights for dropdown / filters
router.get('/', highlightController.getActiveHighlights);

module.exports = router;
