const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../../middlewares/auth');
const transmissionController = require('../../../controllers/transmissionController');

// All routes require auth + admin role
router.use(protect, adminOnly);

router.post('/', transmissionController.createTransmission);
router.put('/:transmission_id', transmissionController.updateTransmission);
router.patch('/:transmission_id/status', transmissionController.updateTransmissionStatus);
router.delete('/:transmission_id', transmissionController.deleteTransmission);

module.exports = router;