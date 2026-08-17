const express = require('express');
const router = express.Router();
const dealerController = require('../../controllers/dealerController');

// All routes are public – no authentication
router.get('/', dealerController.getDealers);
router.get('/:id', dealerController.getDealer);
router.get('/:id/cars', dealerController.getDealerCars);

module.exports = router;
