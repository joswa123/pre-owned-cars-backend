const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'profiles',
    format: async (req, file) => 'png',
    public_id: (req, file) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      return `profile-${req.user.id}-${unique}`;
    },
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
  const path = require('path');
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_MIMES.includes(mimetype)) {
    return cb(null, true);
  }

  if (EXT_TO_MIME[ext]) {
    file.mimetype = EXT_TO_MIME[ext];
    return cb(null, true);
  }

  return cb(new Error('Only image files are allowed'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

module.exports = upload;