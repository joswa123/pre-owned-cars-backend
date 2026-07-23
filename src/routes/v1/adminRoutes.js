const express = require("express");
const Joi = require("joi");
const validate = require("../../middlewares/validate");
const router = express.Router();
const { protect, adminOnly } = require("../../middlewares/auth");
const { brandUpload } = require("../../middlewares/upload");
const multer = require("multer");
const brandController = require("../../controllers/brandController");
const carController = require("../../controllers/carController");

// All routes require authentication and admin role
router.use(protect, adminOnly);

const handleUpload = (req, res, next) => {
  brandUpload.single("logo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Brand routes
router.route("/brands")
  .get(brandController.getAllBrands)
  .post(handleUpload, brandController.createBrand);

router.route("/brands/:id")
  .get(brandController.getBrand)
  .put(handleUpload, brandController.updateBrand)
  .delete(brandController.deleteBrand);

// Car routes
router.get("/cars", carController.getAdminCars);

router.get("/stats", protect, adminOnly, carController.getAdminStats);

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid("active", "inactive", "sold", "pending").required(),
});

router.put(
  "/cars/:id/status",
  validate(statusUpdateSchema),
  carController.updateCarStatus
);
router.patch(
  '/cars/:id/featured',
  protect,
  adminOnly,
  carController.toggleFeatured
);
module.exports = router;
