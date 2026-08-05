const carCatalogService = require('../services/carCatalogService');
const externalCatalogApi = require('../services/externalCatalogApi');
const { catchAsync } = require('../utils/errorHandler');

/**
 * GET /api/v1/catalog/brands
 * Get list of all active car brands
 */
exports.getBrands = catchAsync(async (req, res) => {
  const { with_counts } = req.query;
  let brands;
  
  if (with_counts === 'true' || with_counts === true) {
    const brandService = require('../services/brandService');
    brands = await brandService.getBrandsWithCarCounts();
  } else {
    brands = await carCatalogService.getAllBrands();
  }
  
  res.status(200).json({
    status: 'success',
    data: { brands },
  });
});

/**
 * GET /api/v1/catalog/brands/:brandId/models
 * Get models under a specific brand
 */
exports.getModelsByBrand = catchAsync(async (req, res) => {
  const { brandId } = req.params;
  const models = await carCatalogService.getModelsByBrand(brandId);
  res.status(200).json({
    status: 'success',
    data: { models },
  });
});

/**
 * GET /api/v1/catalog/models/:modelId/variants
 * Get variants under a specific model
 */
exports.getVariantsByModel = catchAsync(async (req, res) => {
  const { modelId } = req.params;
  const variants = await carCatalogService.getVariantsByModel(modelId);
  res.status(200).json({
    status: 'success',
    data: { variants },
  });
});

/**
 * GET /api/v1/catalog/search?q=swift&page=1&limit=20
 * Search catalog across brands, models, and variants
 */
exports.searchCatalog = catchAsync(async (req, res) => {
  const { q = '', page = 1, limit = 20 } = req.query;
  const result = await carCatalogService.searchCatalog(q, Number(page), Number(limit));
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * POST /api/v1/catalog/sync (Admin endpoint or internal worker trigger)
 * Triggers full sync with external API / baseline catalog dataset
 */
exports.triggerSync = catchAsync(async (req, res) => {
  const externalData = await externalCatalogApi.fetchExternalCatalogData();
  const summary = await carCatalogService.syncCatalogData(externalData);

  res.status(200).json({
    status: 'success',
    message: 'Vehicle catalog synchronization completed successfully.',
    data: summary,
  });
});
