const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const leadController = require('../../controllers/leadController');

router.post('/:id/enquire', leadController.enquire);
router.get('/seller', protect, leadController.getSellerLeads);
router.put('/:leadId/unlock', protect, leadController.unlockLead);

module.exports = router;
