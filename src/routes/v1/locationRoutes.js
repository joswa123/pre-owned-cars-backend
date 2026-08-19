const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/locationController');
const { limiter } = require('../../middlewares/rateLimiter');

const { cacheMiddleware } = require('../../middlewares/cacheMiddleware');

// Public endpoints – no authentication needed
router.get('/', locationController.getFullHierarchy);
router.get('/states', cacheMiddleware(86400, { ignoreAuth: true }), locationController.getStates);
router.get('/cities', locationController.getAllCities);
router.get('/states/:stateId/districts', locationController.getDistrictsByState);
router.get('/districts/:districtId/cities', locationController.getCitiesByDistrict);
router.get('/states/:stateId/cities', locationController.getCitiesByState);
router.post('/seed', locationController.seedLocations);
router.get('/dealers', limiter, locationController.getDealersByLocation);
router.get('/dealers/:dealerId', limiter, locationController.getDealerProfile);

module.exports = router;