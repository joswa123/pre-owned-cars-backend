const brandService = require('../services/brandService');
const { brandSchema, brandUpdateSchema } = require('../validations/brandValidation');

exports.getAllBrands = async (req, res, next) => {
  try {
    const brands = await brandService.getAllBrands();
    res.json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

exports.getBrand = async (req, res, next) => {
  try {
    const brand = await brandService.getBrandById(req.params.id);
    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

exports.createBrand = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = brandSchema.validate(req.body, { stripUnknown: true });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Uploaded file from multer
    const logoFile = req.file;

    // Create brand
    const brand = await brandService.createBrand(value, logoFile);

    return res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateBrand = async (req, res, next) => {
  try {
    const { error, value } = brandUpdateSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const brand = await brandService.updateBrand(req.params.id, value, req.file);
    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

exports.deleteBrand = async (req, res, next) => {
  try {
    const result = await brandService.deleteBrand(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};