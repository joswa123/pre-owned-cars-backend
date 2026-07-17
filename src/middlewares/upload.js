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

// ─── File Filter ────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",'application/octet-stream'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  } 
  // const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  // const mime = allowed.test(file.mimetype);
  // if (mime && ext) return cb(null, true);
  // cb(new Error('Only image files are allowed'), false);
};  

// ─── Factory: Create a Cloudinary-backed Multer instance ─
/**
 * Creates a multer instance that uploads to a specific Cloudinary folder.
 * @param {string} folderName - Cloudinary folder (e.g. 'brands', 'cars')
 * @returns {multer.Multer}
 */
function createUpload(folderName) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: folderName,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      public_id: (req, file) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        return `${folderName}-${unique}`;
      },
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
};