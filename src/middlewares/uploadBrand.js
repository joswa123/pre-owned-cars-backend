/**
 * Multer Configuration for Brand Image Uploads
 *
 * Purpose: Configures how brand images are received, validated, and saved.
 * - On Vercel: saves to /tmp/uploads/brands/ (ephemeral, only /tmp is writable).
 * - On Render / Local: saves to <project-root>/uploads/brands/ (persistent).
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Upload Directory Resolution ──────────────────────────────────────────────
// Vercel: only /tmp is writable (serverless, ephemeral)
// Render / Local: use project-relative uploads/brands/ folder
const isVercel = !!process.env.VERCEL;

const brandDir = isVercel
  ? path.join(os.tmpdir(), 'uploads', 'brands')
  : path.join(__dirname, '..', '..', 'uploads', 'brands'); // <root>/uploads/brands

console.log(`📁 Brand upload directory: ${brandDir}`);

// ─── Ensure Directory Exists ──────────────────────────────────────────────────
const ensureDirExists = (dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created upload directory: ${dir}`);
    }
  } catch (err) {
    console.error(`❌ Failed to create upload directory: ${dir}`, err);
    throw err;
  }
};

// ─── Storage Configuration ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureDirExists(brandDir);
      cb(null, brandDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `brand-${unique}${ext}`);
  },
});

// ─── File Filter ──────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (mime && ext) return cb(null, true);
  cb(new Error('Only image files are allowed'), false);
};

// ─── Multer Instance ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter,
});

module.exports = upload;