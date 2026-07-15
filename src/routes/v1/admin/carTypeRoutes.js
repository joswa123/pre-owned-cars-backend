const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../../middlewares/auth');
const carTypeController = require('../../../controllers/carTypeController');

router.use(protect, adminOnly);

router.post('/', carTypeController.createCarType);
router.put('/:id', carTypeController.updateCarType);
router.delete('/:id', carTypeController.deleteCarType);

module.exports = router;