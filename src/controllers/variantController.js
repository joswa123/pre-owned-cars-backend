const variantService = require('../services/variantService');
const { catchAsync } = require('../utils/errorHandler');
const { AppError } = require('../utils/errorHandler');

// --- Public GET (no auth) ---
exports.getAllVariants = catchAsync(async (req, res) => {
  const { modelId } = req.query;
  const variants = await variantService.getAllVariants(modelId);
  res.status(200).json({ success: true, data: variants });
});

exports.getVariant = catchAsync(async (req, res) => {
  const { id } = req.params;
  const variant = await variantService.getVariantById(id);
  res.status(200).json({ success: true, data: variant });
});

// --- Admin only ---
exports.createVariant = catchAsync(async (req, res) => {
  const { name, model_id } = req.body;
  const newVariant = await variantService.createVariant({ name, model_id });
  res.status(200).json({ success: true, data: newVariant });
});

/**
 * Bulk create variants
 * POST /admin/variants/bulk
 * Body: { modelId: 'uuid', variants: ['VX', 'ZX', 'G'] }
 */
exports.bulkCreateVariants = catchAsync(async (req, res) => {
  const { modelId, variants } = req.body;

  if (!modelId) throw new AppError('modelId is required', 400);
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new AppError('variants must be a non-empty array of strings', 400);
  }

  const result = await variantService.bulkCreateVariants(modelId, variants);

  res.status(200).json({
    success: true,
    message: `${result.created.length} variant(s) created, ${result.skipped.length} skipped (already existed)`,
    data: result,
  });
});

exports.updateVariant = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, model_id } = req.body;
  const updated = await variantService.updateVariant(id, { name, model_id });
  res.status(200).json({ success: true, data: updated });
});

exports.deleteVariant = catchAsync(async (req, res) => {
  const { id } = req.params;
  await variantService.deleteVariant(id);
  res.status(200).json({ success: true, message: 'Variant deleted' });
});
