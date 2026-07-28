// routes/v1/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const subscriptionController = require('../../controllers/subscriptionController');

router.get('/subscription/status', protect, subscriptionController.getStatus);
router.post('/subscription/create', protect, subscriptionController.createSubscription);
router.post('/subscription/verify', protect, subscriptionController.verifyPayment);

module.exports = router;