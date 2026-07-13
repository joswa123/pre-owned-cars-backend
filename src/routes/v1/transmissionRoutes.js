const express = require('express');
const router = express.Router();
const transmissionController = require('../../controllers/transmissionController');

// Public GET – no auth
router.get('/', transmissionController.getAllTransmissions);
router.get('/:transmission_id', transmissionController.getTransmission);

module.exports = router;