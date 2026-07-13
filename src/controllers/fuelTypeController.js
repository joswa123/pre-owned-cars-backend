const fuelTypeService = require('../services/fuelService');
const { AppError } = require('../utils/errorHandler');

// --- Public GET (no auth) ---
exports.getAllFuelTypes = async (req, res, next) => {
  try {
    const fuelTypes = await fuelTypeService.getFuelTypes();
    res.status(200).json({ success: true, data: fuelTypes });
  } catch (error) {
    next(error);
  }
};

exports.getFuelType = async (req, res, next) => {
  try {
    const { fuel_type_id } = req.params;
    const fuelType = await fuelTypeService.getFuelType(fuel_type_id);
    if (!fuelType) {
      return res.status(404).json({ success: false, message: 'Fuel type not found' });
    }
    res.status(200).json({ success: true, data: fuelType });
  } catch (error) {
    next(error);
  }
};

// --- Admin-only routes (require authentication) ---
exports.createFuelType = async (req, res, next) => {
  try {
    const { fuel_type_name, status } = req.body;
    // user_id comes from the logged-in admin
    const user_id = req.user.id;

    const fuelTypeData = { user_id, fuel_type_name, status };
    const newFuelType = await fuelTypeService.createFuelType(fuelTypeData);
    res.status(201).json({ success: true, data: newFuelType });
  } catch (error) {
    next(error);
  }
};

exports.updateFuelType = async (req, res, next) => {
  try {
    const { fuel_type_id } = req.params;
    const { fuel_type_name, status } = req.body;
    const user_id = req.user.id; // admin performing update

    const fuelTypeData = { user_id, fuel_type_name, status };
    const updated = await fuelTypeService.updateFuelType(fuel_type_id, fuelTypeData);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Fuel type not found' });
    }
    res.status(200).json({ success: true, message: 'Fuel type updated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteFuelType = async (req, res, next) => {
  try {
    const { fuel_type_id } = req.params;
    const deleted = await fuelTypeService.deleteFuelType(fuel_type_id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Fuel type not found' });
    }
    res.status(200).json({ success: true, message: 'Fuel type deleted' });
  } catch (error) {
    next(error);
  }
};

// Optional: status update (if needed)
exports.updateFuelTypeStatus = async (req, res, next) => {
  try {
    const { fuel_type_id } = req.params;
    const { status } = req.body;
    const updated = await fuelTypeService.updateFuelTypeStatus(fuel_type_id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Fuel type not found' });
    }
    res.status(200).json({ success: true, message: 'Status updated' });
  } catch (error) {
    next(error);
  }
};