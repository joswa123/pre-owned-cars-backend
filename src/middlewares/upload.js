const multer = require('multer');
const path = require('path');
const { AppError } = require('../utils/errorHandler');

const fs = require('fs');
const os = require('os');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
      const dest = isVercel ? path.join(os.tmpdir(), 'uploads') : 'uploads/';
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter – allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed.', 400), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter,
});

// Middleware for multiple images (max 5)
const uploadImages = upload.array('images', 5);

module.exports = { uploadImages };