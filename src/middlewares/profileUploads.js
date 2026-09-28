const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const crypto = require('crypto');
const path = require('path');
const { AppError } = require('../utils/errorHandler');

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id || req.params?.userId || 'unknown';
    const uuid = crypto.randomUUID();
    return {
      folder: `autodeal4u/avatars/${userId}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'],
      transformation: [
        { width: 1600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
      ],
      public_id: `avatar-${uuid}`,
    };
  },
});

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/bmp',
  'application/octet-stream',
];

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.bmp': 'image/bmp',
};

const fileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_MIMES.includes(mimetype) || EXT_TO_MIME[ext]) {
    if (EXT_TO_MIME[ext]) {
      file.mimetype = EXT_TO_MIME[ext];
    }
    return cb(null, true);
  }

  return cb(new AppError('Only image files are allowed. Formats: JPG, JPEG, PNG, WEBP, GIF, HEIC.', 400), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

module.exports = upload;