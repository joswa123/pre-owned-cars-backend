const express = require('express');
const router = express.Router();
const dealerController = require('../../controllers/dealerController');
const { optionalAuth } = require('../../middlewares/auth');
const { dealerFilterLimiter } = require('../../middlewares/rateLimiter');

// All routes support optional auth for 'me' resolution
router.get('/', dealerController.getDealers);
router.get('/:id/cars/filters', optionalAuth, dealerFilterLimiter, dealerController.getDealerCarFilters);
router.get('/:id/cars', optionalAuth, dealerController.getDealerCars);
router.get('/:id', optionalAuth, dealerController.getDealer);

module.exports = router;
