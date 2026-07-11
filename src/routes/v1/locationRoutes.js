const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/locationController');

// Public endpoints – no authentication needed
router.get('/states', locationController.getStates);
router.get('/cities', locationController.getAllCities);
router.get('/states/:stateId/cities', locationController.getCitiesByState);

module.exports = router;