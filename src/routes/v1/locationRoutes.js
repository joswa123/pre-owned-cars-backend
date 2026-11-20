const express = require('express');
const router = express.Router();
const locationController = require('../../controllers/locationController');
const dealerController = require('../../controllers/dealerController');
const { limiter, dealerFilterLimiter } = require('../../middlewares/rateLimiter');
const { optionalAuth } = require('../../middlewares/auth');

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
router.get('/dealers/:dealerId', limiter, optionalAuth, locationController.getDealerProfile);
router.get('/dealers/:dealerId/cars/filters', optionalAuth, dealerFilterLimiter, dealerController.getDealerCarFilters);
router.get('/dealers/:dealerId/cars', limiter, optionalAuth, locationController.getDealerCars);
router.get('/dealers/:dealerId/commercial/filters', optionalAuth, dealerFilterLimiter, dealerController.getDealerCommercialFilters);
router.get('/dealers/:dealerId/commercial', limiter, optionalAuth, locationController.getDealerCommercialVehicles);

module.exports = router;