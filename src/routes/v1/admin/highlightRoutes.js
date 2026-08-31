const express = require('express');
const router = express.Router();
const highlightController = require('../../../controllers/highlightController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const { createHighlightSchema, updateHighlightSchema } = require('../../../validations/highlightValidation');

// All routes require authentication and admin role
router.use(protect, adminOnly);

// Admin Highlights CRUD
router.get('/', highlightController.getAllHighlights);
router.post('/', validate(createHighlightSchema), highlightController.createHighlight);
router.put('/:id', validate(updateHighlightSchema), highlightController.updateHighlight);
router.delete('/:id', highlightController.deleteHighlight);

module.exports = router;
