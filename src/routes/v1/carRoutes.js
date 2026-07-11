const express = require('express');
const router = express.Router();
const carController = require('../../controllers/carController');
const { protect } = require('../../middlewares/auth');
const { uploadImages } = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const { carSchema } = require('../../validations/carValidation');

// Public routes
router.get('/', carController.getCars);
router.get('/:id', carController.getCarById);

// Protected routes (require authentication)
router.use(protect);

router.post('/', uploadImages, validate(carSchema), carController.createCar);
router.get('/my/listings', carController.getUserCars);
router.put('/:id', validate(carSchema), carController.updateCar);
router.delete('/:id', carController.deleteCar);

module.exports = router;