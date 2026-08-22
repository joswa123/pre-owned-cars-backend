// routes/v1/leadRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const {
  createLeadSchema,
  updateLeadStatusSchema,
} = require('../../validations/leadValidation');
const leadController = require('../../controllers/leadController');

// ── Enquiry & Drill-Down Endpoints ─────────────────────────────────
router.post('/', protect, validate(createLeadSchema), leadController.createLead);
router.get('/summary', protect, leadController.getLeadSummary);
router.get('/car/:carId', protect, leadController.getCarLeads);
router.get('/seller', protect, leadController.getSellerLeads);
router.get('/seller/summary', protect, leadController.getLeadSummary);
router.get('/seller/car/:carId', protect, leadController.getCarLeads);
router.get('/me', protect, leadController.getBuyerLeads);
router.patch('/batch-read', protect, leadController.batchMarkAsRead);
router.patch('/:id/read', protect, leadController.markAsRead);
router.patch('/:id/status', protect, validate(updateLeadStatusSchema), leadController.updateLeadStatus);

// ── Legacy Compatibility Endpoints ────────────────────────────────
router.post('/:id/enquire', protect, leadController.enquire);
router.put('/:leadId/unlock', protect, leadController.unlockLead);

module.exports = router;
