const express = require('express');
const router = express.Router();
const cityController = require('../../controllers/admin-cityController');
const validate = require('../../middlewares/validate');
const { addcitySchema } = require('../../validations/admin-cityValidation');

router.post('/add-city', validate(addcitySchema), cityController.createCity);
router.get('/get-cities', cityController.getCities);

module.exports = router;