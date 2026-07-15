/**
 * Multer Configuration for Brand Image Uploads
 * 
 * Purpose: Configures how brand images are received, validated, and saved.
 * - In development: saves to local `uploads/brands/` folder.
 * - In production (Vercel): saves to `/tmp/uploads/brands/` (ephemeral).
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Determine the appropriate upload directory based on environment
const getUploadDir = () => {
  // Vercel sets `VERCEL` env var automatically; also check NODE_ENV
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  
  if (isVercel) {
    // On Vercel, only /tmp is writable
    const dir = path.join(os.tmpdir(), 'uploads', 'brands');
    console.log(`📁 Vercel environment detected – using temp directory: ${dir}`);
    return dir;
  } else {
    // Local development – store in project's uploads folder
    const dir = path.join(__dirname, '..', 'uploads', 'brands');
    console.log(`📁 Development environment – using local directory: ${dir}`);
    return dir;
  }
};

const brandDir = getUploadDir();

// Ensure the directory exists (lazy creation on first upload)
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

// Storage configuration
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
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `brand-${unique}${ext}`);
  }
});

// File filter – only allow images
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (mime && ext) return cb(null, true);
  cb(new Error('Only image files are allowed'), false);
};

// Multer instance
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter
});

module.exports = upload;