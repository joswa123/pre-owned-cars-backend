const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../utils/errorHandler');

const isTestEnv = (process.env.NODE_ENV || '').trim() === 'test';

// Validate configuration for non-test environments
if (!isCloudinaryConfigured && !isTestEnv) {
  throw new Error('Cloudinary configuration missing. Uploads must be stored in Cloudinary for production.');
}

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
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();

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

// ─── Cloudinary Storages (Zero Local Disk Writes) ───────────────────

// Common image transformation at upload time:
// quality: "auto:good", fetch_format: "auto", max width 1600px, crop: "limit"
const IMAGE_UPLOAD_TRANSFORMATION = [
  { width: 1600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
];

/**
 * Creates an in-memory stream-consuming mock storage for automated test suites
 * that send dummy text strings for video/audio.
 */
function createTestMediaStorage(resourceType) {
  return {
    _handleFile(req, file, cb) {
      file.stream.resume(); // Drain stream in memory
      const carId = req.carId || req.params?.id || crypto.randomUUID();
      const uuid = crypto.randomUUID();
      const prefix = file.fieldname === 'video' ? 'video' : (file.fieldname === 'audio' ? 'audio' : 'media');
      const ext = file.fieldname === 'video' ? 'mp4' : (file.fieldname === 'audio' ? 'mp3' : 'png');
      const publicId = `autodeal4u/cars/${carId}/${prefix}-${uuid}`;
      const secureUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'fub1whjx'}/${resourceType}/upload/v${Date.now()}/${publicId}.${ext}`;

      cb(null, {
        path: secureUrl,
        size: file.size || 42,
        filename: publicId,
        secure_url: secureUrl,
        public_id: publicId,
      });
    },
    _removeFile(req, file, cb) {
      cb(null);
    },
  };
}

// Video storage
const videoStorage = isTestEnv
  ? createTestMediaStorage('video')
  : new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const carId = req.carId || req.params?.id || req.body?.car_id || crypto.randomUUID();
        req.carId = carId;
        const uuid = crypto.randomUUID();
        return {
          folder: `autodeal4u/cars/${carId}/videos`,
          resource_type: 'video',
          public_id: `video-${uuid}`,
        };
      },
    });

// Audio storage
const audioStorage = isTestEnv
  ? createTestMediaStorage('video')
  : new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const carId = req.carId || req.params?.id || req.body?.car_id || crypto.randomUUID();
        req.carId = carId;
        const uuid = crypto.randomUUID();
        return {
          folder: `autodeal4u/cars/${carId}/audio`,
          resource_type: 'video', // Cloudinary handles audio as video resource type
          public_id: `audio-${uuid}`,
        };
      },
    });

// Combined car media storage: handles primary_image, images, video, and audio
// Streams images directly to Cloudinary across ALL environments.
const carMediaCloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const carId = req.carId || req.params?.id || req.body?.car_id || crypto.randomUUID();
    req.carId = carId;
    const uuid = crypto.randomUUID();

    if (file.fieldname === 'video') {
      return {
        folder: `autodeal4u/cars/${carId}/videos`,
        resource_type: 'video',
        public_id: `video-${uuid}`,
      };
    }
    if (file.fieldname === 'audio') {
      return {
        folder: `autodeal4u/cars/${carId}/audio`,
        resource_type: 'video',
        public_id: `audio-${uuid}`,
      };
    }

    const prefix = file.fieldname === 'primary_image' ? 'primary' : 'car';
    return {
      folder: `autodeal4u/cars/${carId}`,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'],
      transformation: IMAGE_UPLOAD_TRANSFORMATION,
      public_id: `${prefix}-${uuid}`,
    };
  },
});

const carMediaStorage = isTestEnv
  ? {
      _handleFile(req, file, cb) {
        // In test mode, allow dummy non-video buffers for video/audio without failing on Cloudinary's ffmpeg checker
        if (file.fieldname === 'video' || file.fieldname === 'audio') {
          return createTestMediaStorage('video')._handleFile(req, file, cb);
        }
        // Images ALWAYS stream directly to Cloudinary
        return carMediaCloudinaryStorage._handleFile(req, file, cb);
      },
      _removeFile(req, file, cb) {
        return carMediaCloudinaryStorage._removeFile(req, file, cb);
      },
    }
  : carMediaCloudinaryStorage;

// ─── Factory: Create a Cloudinary-backed Multer instance for Other Entities ─
function createUpload(folderName, extraParams = {}) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const uuid = crypto.randomUUID();
      const prefix = folderName === 'banners' ? 'banner' : (folderName === 'brands' ? 'brand' : folderName);
      return {
        folder: `autodeal4u/${folderName}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'],
        transformation: IMAGE_UPLOAD_TRANSFORMATION,
        public_id: `${prefix}-${uuid}`,
        ...extraParams,
      };
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
    fileSize: 100 * 1024 * 1024, // 100 MB max per file
  },
  fileFilter: carMediaFileFilter,
}).fields([
  { name: 'primary_image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
]);

// ─── Named Exports ─────────────────────────────────────
module.exports = {
  uploadVideo: wrapMulter(uploadVideoRaw.single('video')),
  uploadAudio: wrapMulter(uploadAudioRaw.single('audio')),
  carMediaUpload: wrapMulter(carMediaUploadRaw),
  wrapMulter,
  brandUpload: createUpload('brands'),
  carUpload: createUpload('cars'),
  profileUpload: createUpload('profiles'),
  bannerUpload: createUpload('banners', {
    transformation: [{ width: 1920, height: 600, crop: 'fill', quality: 'auto:good', fetch_format: 'auto' }],
  }),
};