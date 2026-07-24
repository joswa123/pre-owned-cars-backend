const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateProfileSchema } = require('../../validations/userValidation');
const upload = require('../../middlewares/profileUploads');

// Protected routes
router.use(protect);

router.get('/me', userController.getProfile);
router.put('/me', validate(updateProfileSchema), userController.updateProfile);

router.put(
  '/me/profile-picture',
  protect,
  upload.single('profile_picture'),
  userController.uploadProfilePicture
);
module.exports = router;