const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Determine upload directory ──────────────────────────────
const isVercel = !!process.env.VERCEL;
const uploadDir = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '..', 'uploads');

// ─── Storage ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'brands'); // or 'cars' depending on usage
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});

// ─── File filter ──────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (mime && ext) return cb(null, true);
  cb(new Error('Only image files are allowed'), false);
};

// ─── Create Multer instance ──────────────────────────────────
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter,
});

// ✅ Export the instance – NOT a specific middleware
module.exports = upload; // 👈 this gives you .single(), .array(), .fields()