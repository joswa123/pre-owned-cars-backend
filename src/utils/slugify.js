const { Op } = require('sequelize');

/**
 * Converts a string into a URL-friendly slug
 * @param {string} text 
 * @returns {string}
 */
function slugify(text) {
  if (!text || typeof text !== 'string') return 'category';
  const slug = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'category';
}

/**
 * Generates a unique slug for a model by appending incrementing counters on collision
 * @param {Object} model - Sequelize model (e.g. CarType)
 * @param {string} name - Base name to slugify
 * @param {string|null} [excludeId=null] - Optional ID to ignore during collision checking (for updates)
 * @returns {Promise<string>}
 */
async function generateUniqueSlug(model, name, excludeId = null) {
  const baseSlug = slugify(name);
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const where = { slug: candidate };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    const existing = await model.findOne({ where, attributes: ['id'] });
    if (!existing) {
      return candidate;
    }
    candidate = `${baseSlug}-${counter++}`;
  }
}

module.exports = {
  slugify,
  generateUniqueSlug,
};
