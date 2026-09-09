const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const { AppError } = require('../utils/errorHandler');
require('dotenv').config();

// ─── Configure Cloudinary ──────────────────────────────
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME.trim() !== '' &&
  process.env.CLOUDINARY_API_KEY.trim() !== '' &&
  process.env.CLOUDINARY_API_SECRET.trim() !== ''
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
  });
}

const isTestOrNoSecret = (process.env.NODE_ENV || '').trim() === 'test' || !isCloudinaryConfigured;

// ─── File Filter & MIME Definitions ────────────────────
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/bmp',
  'application/octet-stream',
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
  'video/3gpp',
  'video/x-m4v',
  'video/mpeg',
  'video/avi',
  'video/x-msvideo',
  'application/octet-stream',
];

const ALLOWED_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv', '.3gp', '.m4v', '.avi'];

const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/x-aac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/3gpp',
  'audio/amr',
  'audio/flac',
  'application/ogg',
  'application/octet-stream',
];

const ALLOWED_AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.webm', '.3gp', '.amr', '.flac'];

// Image-only filter
const imageFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (EXT_TO_IMAGE_MIME[ext] || ALLOWED_IMAGE_MIMES.includes(mimetype)) {
    if (EXT_TO_IMAGE_MIME[ext]) {
      file.mimetype = EXT_TO_IMAGE_MIME[ext];
    }
    return cb(null, true);
  }

  return cb(new AppError('Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP, GIF, HEIC.', 400), false);
};

// Video-only filter
const videoFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_VIDEO_EXTS.includes(ext) || (ALLOWED_VIDEO_MIMES.includes(mimetype) && mimetype !== 'application/octet-stream')) {
    return cb(null, true);
  }
  return cb(new AppError('Invalid video format. Allowed formats: MP4, WebM, MOV, MKV, 3GP, M4V, AVI.', 400), false);
};

// Audio-only filter
const audioFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_AUDIO_EXTS.includes(ext) || (ALLOWED_AUDIO_MIMES.includes(mimetype) && mimetype !== 'application/octet-stream')) {
    return cb(null, true);
  }
  return cb(new AppError('Invalid audio format. Allowed formats: MP3, WAV, AAC, M4A, OGG, FLAC.', 400), false);
};

// Combined Car Media filter
const carMediaFileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (file.fieldname === 'video') {
    if (ALLOWED_VIDEO_EXTS.includes(ext) || (ALLOWED_VIDEO_MIMES.includes(mimetype) && mimetype !== 'application/octet-stream')) {
      return cb(null, true);
    }
    return cb(new AppError('Invalid video format. Allowed formats: MP4, WebM, MOV, MKV, 3GP, M4V, AVI.', 400), false);
  }

  if (file.fieldname === 'audio') {
    if (ALLOWED_AUDIO_EXTS.includes(ext) || (ALLOWED_AUDIO_MIMES.includes(mimetype) && mimetype !== 'application/octet-stream')) {
      return cb(null, true);
    }
    return cb(new AppError('Invalid audio format. Allowed formats: MP3, WAV, AAC, M4A, OGG, FLAC.', 400), false);
  }

  if (file.fieldname === 'primary_image' || file.fieldname === 'images') {
    return imageFileFilter(req, file, cb);
  }

  return cb(new AppError(`Unexpected field "${file.fieldname}". Allowed file fields: primary_image, images, video, audio.`, 400), false);
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

  const rawMulter = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  });

  return wrapMulter(rawMulter.single('image'));
}

// ─── Multer Error Handling Wrapper ───────────────────────
function wrapMulter(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const field = err.field;
            let limitDesc = '10MB for images, 20MB for audio, 100MB for video';
            if (field === 'video') limitDesc = '100MB';
            else if (field === 'audio') limitDesc = '20MB';
            else if (field === 'primary_image' || field === 'images' || field === 'image') limitDesc = '10MB';
            return next(new AppError(`File size exceeds allowable limit (${limitDesc}) for field "${field || 'file'}".`, 413));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError(`Unexpected field "${err.field}". Allowed file fields: primary_image, images, video, audio.`, 400));
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return next(new AppError(`Too many files uploaded for field "${err.field}".`, 400));
          }
          return next(new AppError(`Upload error (${err.code}): ${err.message}`, 400));
        }
        if (err instanceof AppError) {
          return next(err);
        }
        if (err.http_code || (err.message && /cloudinary|cloud_name|api_key/i.test(err.message))) {
          return next(new AppError(`Cloudinary upload failed: ${err.message}`, err.http_code || 400));
        }
        return next(new AppError(err.message || 'File upload failed', 400));
      }
      next();
    });
  };
}

// ─── Raw Multer Instances ───────────────────────────────
const uploadVideoRaw = multer({
  storage: videoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: videoFileFilter,
});

const uploadAudioRaw = multer({
  storage: audioStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: audioFileFilter,
});

const carMediaUploadRaw = multer({
  storage: carMediaStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB per file max
  },
  fileFilter: carMediaFileFilter,
}).fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
]);

// ─── Named Exports (All Wrapped for Safe Error Handling) ─
module.exports = {
  uploadVideo: wrapMulter(uploadVideoRaw.single('video')),
  uploadAudio: wrapMulter(uploadAudioRaw.single('audio')),
  carMediaUpload: wrapMulter(carMediaUploadRaw),
  wrapMulter,
  brandUpload: createUpload('brands'),
  carUpload: createUpload('cars'),
  profileUpload: createUpload('profiles'),
  bannerUpload: createUpload('banners', {
    transformation: [{ width: 1920, height: 600, crop: 'fill' }],
  }),
};