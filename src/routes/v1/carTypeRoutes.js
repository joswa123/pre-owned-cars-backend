const express = require('express');
const router = express.Router();
const carTypeController = require('../../controllers/carTypeController');

router.get('/', carTypeController.getAllCarTypes);
router.get('/:id', carTypeController.getCarType);

module.exports = router;