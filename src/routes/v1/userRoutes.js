const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateProfileSchema } = require('../../validations/userValidation');
const { authPlugins } = require('mysql2');
const { uploadProfile } = require("../../middlewares/uploadUser");

// Protected routes
router.use(protect);

router.get('/get-profile/:id', userController.getProfile);
router.put('/update-profile/:id', uploadProfile,validate(updateProfileSchema), userController.updateProfile);

module.exports = router;