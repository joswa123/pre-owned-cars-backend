const carTypeService = require('../services/carTypeService');

// --- Public GET ---
exports.getAllCarTypes = async (req, res, next) => {
  try {
    const carTypes = await carTypeService.getAllCarTypes();
    res.status(200).json({ success: true, data: carTypes });
  } catch (error) {
    next(error);
  }
};

exports.getCarType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const carType = await carTypeService.getCarTypeById(id);
    res.status(200).json({ success: true, data: carType });
  } catch (error) {
    next(error);
  }
};

// --- Admin only ---
exports.createCarType = async (req, res, next) => {
  try {
    const { name } = req.body;
    const newCarType = await carTypeService.createCarType({ name });
    res.status(201).json({ success: true, data: newCarType });
  } catch (error) {
    next(error);
  }
};

exports.updateCarType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updated = await carTypeService.updateCarType(id, { name });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteCarType = async (req, res, next) => {
  try {
    const { id } = req.params;
    await carTypeService.deleteCarType(id);
    res.status(200).json({ success: true, message: 'Car type deleted' });
  } catch (error) {
    next(error);
  }
};