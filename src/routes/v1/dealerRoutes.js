const express = require('express');
const router = express.Router();
const dealerController = require('../../controllers/dealerController');
const { optionalAuth } = require('../../middlewares/auth');

// All routes support optional auth for 'me' resolution
router.get('/', dealerController.getDealers);
router.get('/:id', optionalAuth, dealerController.getDealer);
router.get('/:id/cars', optionalAuth, dealerController.getDealerCars);

module.exports = router;
