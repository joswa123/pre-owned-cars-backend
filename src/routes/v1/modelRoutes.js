const express = require('express');
const router = express.Router();
const modelController = require('../../controllers/modelController');

// Public – no auth required
router.get('/', modelController.getAllModels);
router.get('/:id', modelController.getModel);

module.exports = router;