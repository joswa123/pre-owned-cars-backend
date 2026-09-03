const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
require('dotenv').config();

// ─── Configure Cloudinary ──────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// ─── File Filter & MIME Normalization ────────────────────
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/bmp',
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

  // 1. If mimetype is already a valid image MIME, accept directly
  if (ALLOWED_MIMES.includes(mimetype)) {
    return cb(null, true);
  }

  // 2. If client/external API sends generic application/octet-stream or missing MIME,
  // validate against known image extensions and normalize the MIME type
  if (EXT_TO_MIME[ext]) {
    file.mimetype = EXT_TO_MIME[ext];
    return cb(null, true);
  }

  return cb(new Error('Only image files are allowed'), false);
};  

// ─── Factory: Create a Cloudinary-backed Multer instance ─
/**
 * Creates a multer instance that uploads to a specific Cloudinary folder.
 * @param {string} folderName - Cloudinary folder (e.g. 'brands', 'cars')
 * @param {object} extraParams - Extra Cloudinary parameters (e.g., transformations)
 * @returns {multer.Multer}
 */
function createUpload(folderName, extraParams = {}) {
  const fs = require('fs');
  const env = (process.env.NODE_ENV || '').trim();
  const isTestOrNoSecret = env === 'test' || !process.env.CLOUDINARY_API_SECRET;

  const storage = isTestOrNoSecret
    ? multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(__dirname, '..', '..', 'uploads', folderName);
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname) || '.png';
          cb(null, `${folderName}-${unique}${ext}`);
        },
      })
    : new CloudinaryStorage({
        cloudinary,
        params: {
          folder: folderName,
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          public_id: (req, file) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            // Prefix specifically for banners to avoid collisions, else just folderName
            const prefix = folderName === 'banners' ? 'banner' : folderName;
            return `${prefix}-${unique}`;
          },
          ...extraParams,
        },
      });

  return multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
    fileFilter,
  });
}

// ─── Named Exports ──────────────────────────────────────
module.exports = {
  brandUpload: createUpload('brands'),
  carUpload: createUpload('cars'),
  profileUpload: createUpload('profiles'),
  bannerUpload: createUpload('banners', {
    transformation: [{ width: 1920, height: 600, crop: 'fill' }],
  }),
};