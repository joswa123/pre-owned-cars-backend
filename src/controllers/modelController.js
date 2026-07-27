const modelService = require('../services/modelService');

// --- Public GET (no auth) ---
// controllers/modelController.js
exports.getAllModels = async (req, res, next) => {
  try {
    const { brandId } = req.query; // 👈 read query param
    const models = await modelService.getAllModels(brandId);
    res.status(200).json({ success: true, data: models });
  } catch (error) {
    next(error);
  }
};

exports.getModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const model = await modelService.getModelById(id);
    res.status(200).json({ success: true, data: model });
  } catch (error) {
    next(error);
  }
};

// --- Admin only ---
exports.createModel = async (req, res, next) => {
  try {
    const { name, brandId } = req.body;
    // user_id not needed; we can log who created if needed
    const newModel = await modelService.createModel({ name, brandId }, req.user.id);
    res.status(200).json({ success: true, data: newModel });
  } catch (error) {
    next(error);
  }
};

exports.updateModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, brandId } = req.body;
    const updated = await modelService.updateModel(id, { name, brandId });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    await modelService.deleteModel(id);
    res.status(200).json({ success: true, message: 'Model deleted' });
  } catch (error) {
    next(error);
  }
};