// routes/v1/carReportRoutes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly, optionalAuth } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const {
  createCarReportSchema,
  updateCarReportStatusSchema,
} = require('../../validations/carReportValidation');
const carReportController = require('../../controllers/carReportController');

// ── Submit Car Report (Logged-in user or Guest) ────────────────────
router.post(
  '/',
  optionalAuth,
  validate(createCarReportSchema, { allowUnknown: false }),
  carReportController.createReport
);

// ── Admin Endpoints ───────────────────────────────────────────────
router.get('/', protect, adminOnly, carReportController.getReports);
router.get('/:id', protect, adminOnly, carReportController.getReportById);
router.patch(
  '/:id',
  protect,
  adminOnly,
  validate(updateCarReportStatusSchema, { allowUnknown: false }),
  carReportController.updateReportStatus
);

module.exports = router;
