const { cloudinary } = require('../config/cloudinary');

/**
 * Checks if a string is a valid Cloudinary URL
 * @param {string} url 
 * @returns {boolean}
 */
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('https://res.cloudinary.com/') || url.startsWith('http://res.cloudinary.com/');
}

/**
 * Extracts public_id from a Cloudinary URL (stripping version, transformations, and extension)
 * Example:
 *   https://res.cloudinary.com/demo/image/upload/v1570979139/autodeal4u/cars/123/car-456.png
 *   => autodeal4u/cars/123/car-456
 * @param {string} url 
 * @returns {string|null}
 */
function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;

  try {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + '/upload/'.length).split('?')[0];
    const segments = pathAfterUpload.split('/');
    const cleanSegments = [];

    for (const seg of segments) {
      if (seg.startsWith('s--') && seg.endsWith('--')) continue; // signed segment
      if (/^v[0-9]+$/.test(seg)) continue; // version segment
      // transformation segment (e.g., f_auto,q_auto,w_1600 or c_limit)
      if (seg.includes(',') || /^(w|h|c|q|f|b|e|g|l|p|r|u|x|y|z|dpr|ar|co|fl)_[a-zA-Z0-9_-]+/.test(seg)) continue;
      cleanSegments.push(seg);
    }

    if (cleanSegments.length === 0) return null;
    const fullPath = cleanSegments.join('/');
    const lastDotIndex = fullPath.lastIndexOf('.');
    return lastDotIndex !== -1 ? fullPath.substring(0, lastDotIndex) : fullPath;
  } catch (err) {
    return null;
  }
}

/**
 * Optimizes a Cloudinary image URL with auto format, quality, and max dimensions
 * @param {string} url 
 * @param {Object} options
 * @returns {string|null}
 */
function getOptimizedCloudinaryUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return null;
  
  // Reject local disk paths and internal paths
  if (url.match(/^[a-zA-Z]:[/\\]/) || url.includes('/uploads/') || url.includes('uploads\\')) {
    return null;
  }

  // Ensure https
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('http://res.cloudinary.com/')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }

  if (!cleanUrl.startsWith('https://res.cloudinary.com/')) {
    return null;
  }

  // Insert delivery transformations if not already present
  if (cleanUrl.includes('/upload/') && !cleanUrl.includes('/upload/f_auto')) {
    const width = options.width || 800;
    const quality = options.quality || 'auto';
    const format = options.format || 'auto';
    const crop = options.crop || 'limit';
    const transformation = `f_${format},q_${quality},w_${width},c_${crop}/`;
    cleanUrl = cleanUrl.replace('/upload/', `/upload/${transformation}`);
  }

  return cleanUrl;
}

/**
 * Destroys a resource from Cloudinary safely
 * @param {string} publicId 
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 * @returns {Promise<Object>}
 */
async function deleteCloudinaryMedia(publicId, resourceType = 'image') {
  if (!publicId) return { result: 'not found' };
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (err) {
    console.warn(`⚠️ Cloudinary destroy failed for public_id "${publicId}":`, err.message);
    return { result: 'error', error: err.message };
  }
}

module.exports = {
  isCloudinaryUrl,
  extractPublicIdFromUrl,
  getOptimizedCloudinaryUrl,
  deleteCloudinaryMedia,
};
