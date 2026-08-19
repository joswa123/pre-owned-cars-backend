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

// ── Enquiry Endpoints ─────────────────────────────────────────────
router.post('/', protect, validate(createLeadSchema), leadController.createLead);
router.get('/seller', protect, leadController.getSellerLeads);
router.get('/me', protect, leadController.getBuyerLeads);
router.patch('/:id/status', protect, validate(updateLeadStatusSchema), leadController.updateLeadStatus);

// ── Legacy Compatibility Endpoints ────────────────────────────────
router.post('/:id/enquire', protect, leadController.enquire);
router.put('/:leadId/unlock', protect, leadController.unlockLead);

module.exports = router;
