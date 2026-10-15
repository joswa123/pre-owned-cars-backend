'use strict';

const express = require('express');
const router = express.Router();
const highlightController = require('../../../controllers/highlightController');
const { protect, adminOnly } = require('../../../middlewares/auth');
const validate = require('../../../middlewares/validate');
const {
  createHighlightSchema,
  updateHighlightSchema,
  patchHighlightSchema,
} = require('../../../validations/highlightValidation');

// All routes require authentication and admin role
router.use(protect, adminOnly);

// Admin Highlights CRUD
router.get('/', highlightController.getAllHighlights);
router.get('/:id', highlightController.getHighlightById);
router.post('/', validate(createHighlightSchema, { allowUnknown: false }), highlightController.createHighlight);
router.put('/:id', validate(updateHighlightSchema, { allowUnknown: false }), highlightController.updateHighlight);
router.patch('/:id', validate(patchHighlightSchema, { allowUnknown: false }), highlightController.patchHighlight);
router.delete('/:id', highlightController.deleteHighlight);

module.exports = router;
