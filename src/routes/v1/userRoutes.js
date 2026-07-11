const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateProfileSchema } = require('../../validations/userValidation');

// Protected routes
router.use(protect);

router.get('/me', userController.getProfile);
router.put('/me', validate(updateProfileSchema), userController.updateProfile);

module.exports = router;