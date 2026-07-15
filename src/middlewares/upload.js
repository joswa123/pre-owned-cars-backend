const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { AppError } = require('../utils/errorHandler');

// ─── Upload Directory Resolution ──────────────────────────────────────────────
// Vercel: only /tmp is writable (serverless, ephemeral)
// Render / Local: use project-relative uploads/ folder
const isVercel = !!process.env.VERCEL;
const uploadBase = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');

// ─── Storage Configuration ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(uploadBase)) {
        fs.mkdirSync(uploadBase, { recursive: true });
      }
      cb(null, uploadBase);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// ─── File Filter ──────────────────────────────────────────────────────────────
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
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter,
});

// Middleware for multiple images (max 5)
const uploadImages = upload.array('images', 5);

module.exports = { uploadImages };