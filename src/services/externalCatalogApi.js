/**
 * External Catalog API Client Adapter
 * Encapsulates integration with commercial auto data providers (Autorox, CarDekho, CarAPI).
 * Provides fallback mechanism to query catalog data.
 */

/**
 * Fetch catalog data from configured external provider
 * @param {string} [brandName] - Optional brand filter
 * @returns {Promise<Array>} List of brand objects with models and variants
 */
exports.fetchExternalCatalogData = async (brandName = null) => {
  const provider = process.env.EXTERNAL_CATALOG_PROVIDER || 'fallback';

  try {
    if (provider === 'autorox' || provider === 'cardekho') {
      // Commercial API Integration template
      const apiKey = process.env.EXTERNAL_CATALOG_API_KEY;
      const apiHost = process.env.EXTERNAL_CATALOG_API_URL;
      
      if (!apiKey || !apiHost) {
        console.warn('⚠️ External API credentials not configured. Falling back to local baseline dataset.');
        return exports.getFallbackCatalogData(brandName);
      }

      // Perform HTTP request (Axios / Fetch)
      // const response = await fetch(`${apiHost}/v1/vehicles?brand=${encodeURIComponent(brandName || '')}`, {
      //   headers: { 'X-Api-Key': apiKey }
      // });
      // return await response.json();
    }

    return exports.getFallbackCatalogData(brandName);
  } catch (error) {
    console.error(`❌ External Catalog API error (${provider}):`, error.message);
    return exports.getFallbackCatalogData(brandName);
  }
};

/**
 * Fallback dataset parser (reads local JSON catalog)
 */
exports.getFallbackCatalogData = (brandName = null) => {
  try {
    const carData = require('../../scripts/car-catalog-data.json');
    if (!brandName) return carData.brands || [];

    return (carData.brands || []).filter(
      (b) => b.name.toLowerCase() === brandName.toLowerCase()
    );
  } catch (err) {
    console.error('❌ Failed to load local fallback catalog:', err.message);
    return [];
  }
};
