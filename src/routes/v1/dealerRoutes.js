const express = require('express');
const router = express.Router();
const dealerController = require('../../controllers/dealerController');
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { addDealerSchema, updateDealerSchema } = require('../../validations/dealerValidation');
const { uploadDealerLogo } = require("../../middlewares/uploadDealer");
const { authPlugins } = require('mysql2');

router.use(protect);

router.post('/create-dealer', uploadDealerLogo, validate(addDealerSchema), dealerController.createDealer);
router.get('/get-dealer/:id', dealerController.getdealerprofile);
router.put('/update-dealer/:id', uploadDealerLogo, validate(updateDealerSchema), dealerController.updatedealerprofile);

module.exports = router;