const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const { AppError } = require('../utils/errorHandler');
require('dotenv').config();

// ─── Configure Cloudinary ──────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isTestOrNoSecret = (process.env.NODE_ENV || '').trim() === 'test' || !process.env.CLOUDINARY_API_SECRET;

// ─── File Filter & MIME Definitions ────────────────────
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/bmp',
];

const EXT_TO_IMAGE_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.bmp': 'image/bmp',
};

const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
];

const ALLOWED_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv'];

const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/x-aac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
];

const ALLOWED_AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.m4a', '.ogg'];

// Image-only filter
const imageFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_IMAGE_MIMES.includes(mimetype) || EXT_TO_IMAGE_MIME[ext]) {
    if (!ALLOWED_IMAGE_MIMES.includes(mimetype) && EXT_TO_IMAGE_MIME[ext]) {
      file.mimetype = EXT_TO_IMAGE_MIME[ext];
    }
    return cb(null, true);
  }

  return cb(new AppError('Only image files are allowed', 400), false);
};

// Video-only filter
const videoFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_VIDEO_MIMES.includes(mimetype) || ALLOWED_VIDEO_EXTS.includes(ext)) {
    return cb(null, true);
  }
  return cb(new AppError('Only MP4, WebM, and QuickTime videos are allowed', 400), false);
};

// Audio-only filter
const audioFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_AUDIO_MIMES.includes(mimetype) || ALLOWED_AUDIO_EXTS.includes(ext)) {
    return cb(null, true);
  }
  return cb(new AppError('Only MP3, WAV, and AAC audio files are allowed', 400), false);
};

// Combined Car Media filter
const carMediaFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (file.fieldname === 'video') {
    if (ALLOWED_VIDEO_MIMES.includes(mimetype) || ALLOWED_VIDEO_EXTS.includes(ext)) {
      return cb(null, true);
    }
    return cb(new AppError('Only MP4, WebM, and QuickTime videos are allowed', 400), false);
  }

  if (file.fieldname === 'audio') {
    if (ALLOWED_AUDIO_MIMES.includes(mimetype) || ALLOWED_AUDIO_EXTS.includes(ext)) {
      return cb(null, true);
    }
    return cb(new AppError('Only MP3, WAV, and AAC audio files are allowed', 400), false);
  }

  // Otherwise images (primary_image, images)
  return imageFileFilter(req, file, cb);
};

// ─── Cloudinary & Disk Storages ──────────────────────────

// Video storage
const videoStorage = isTestOrNoSecret
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'cars', 'videos');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.mp4';
        cb(null, `video-${unique}${ext}`);
      },
    })
  : new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'cars/videos',
        resource_type: 'video',
        public_id: (req, file) => `video-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      },
    });

// Audio storage
const audioStorage = isTestOrNoSecret
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'cars', 'audio');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.mp3';
        cb(null, `audio-${unique}${ext}`);
      },
    })
  : new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'cars/audio',
        resource_type: 'video', // Cloudinary treats audio as video resource type
        public_id: (req, file) => `audio-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        format: 'mp3',
      },
    });

// Combined car media storage
const carMediaStorage = isTestOrNoSecret
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        let subfolder = 'cars';
        if (file.fieldname === 'video') subfolder = path.join('cars', 'videos');
        else if (file.fieldname === 'audio') subfolder = path.join('cars', 'audio');

        const uploadPath = path.join(__dirname, '..', '..', 'uploads', subfolder);
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const defaultExt = file.fieldname === 'video' ? '.mp4' : file.fieldname === 'audio' ? '.mp3' : '.png';
        const ext = path.extname(file.originalname) || defaultExt;
        const prefix = file.fieldname === 'video' ? 'video' : file.fieldname === 'audio' ? 'audio' : 'cars';
        cb(null, `${prefix}-${unique}${ext}`);
      },
    })
  : new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        if (file.fieldname === 'video') {
          return {
            folder: 'cars/videos',
            resource_type: 'video',
            public_id: `video-${unique}`,
          };
        }
        if (file.fieldname === 'audio') {
          return {
            folder: 'cars/audio',
            resource_type: 'video',
            public_id: `audio-${unique}`,
            format: 'mp3',
          };
        }
        return {
          folder: 'cars',
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          public_id: `cars-${unique}`,
        };
      },
    });

// ─── Factory: Create a Cloudinary-backed Multer instance for Images ─
function createUpload(folderName, extraParams = {}) {
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
            const prefix = folderName === 'banners' ? 'banner' : folderName;
            return `${prefix}-${unique}`;
          },
          ...extraParams,
        },
      });

  return multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  });
}

// ─── Multer Instances ───────────────────────────────────
const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: videoFileFilter,
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: audioFileFilter,
});

const carMediaUpload = multer({
  storage: carMediaStorage,
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB total per request
  },
  fileFilter: carMediaFileFilter,
}).fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
]);

// ─── Named Exports ──────────────────────────────────────
module.exports = {
  uploadVideo,
  uploadAudio,
  carMediaUpload,
  brandUpload: createUpload('brands'),
  carUpload: createUpload('cars'),
  profileUpload: createUpload('profiles'),
  bannerUpload: createUpload('banners', {
    transformation: [{ width: 1920, height: 600, crop: 'fill' }],
  }),
};