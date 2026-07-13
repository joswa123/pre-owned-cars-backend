const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../middlewares/auth');
const upload = require('../../middlewares/uploadBrand');
const multer = require('multer');
const brandController = require('../../controllers/brandController');
// const modelController = require('../../controllers/modelController');

// All routes require authentication and admin role
router.use(protect, adminOnly);

const handleUpload = (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Brand routes
router.route('/brands')
  .get(brandController.getAllBrands)
  .post(handleUpload, brandController.createBrand);

router.route('/brands/:id')
  .get(brandController.getBrand)
  .put(handleUpload, brandController.updateBrand)
  .delete(brandController.deleteBrand);

// Model routes
// router.route('/models')
//   .get(modelController.getAllModels)
//   .post(modelController.createModel);

// router.route('/models/:id')
//   .get(modelController.getModel)
//   .put(modelController.updateModel)
//   .delete(modelController.deleteModel);

module.exports = router;