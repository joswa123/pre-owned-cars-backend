const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Determine whether Cloudinary is configured via CLOUDINARY_URL or individual credentials
const hasCloudinaryUrl = Boolean(process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.trim() !== '');
const hasIndividualCredentials = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME.trim() !== '' &&
  process.env.CLOUDINARY_API_KEY.trim() !== '' &&
  process.env.CLOUDINARY_API_SECRET.trim() !== ''
);

const isCloudinaryConfigured = hasCloudinaryUrl || hasIndividualCredentials;

if (hasCloudinaryUrl) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL.trim(),
    secure: true,
  });
} else if (hasIndividualCredentials) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
}

// In production, strictly enforce that Cloudinary must be configured
if (!isCloudinaryConfigured && (process.env.NODE_ENV || '').trim() === 'production') {
  throw new Error('Cloudinary configuration missing. All uploads must be stored on Cloudinary in production.');
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
};
