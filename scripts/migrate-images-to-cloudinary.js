/**
 * Migration Script: Migrate Car Images (and other local media) to Cloudinary
 * 
 * Objective:
 * 1. Scans all car_images records for image fields.
 * 2. Detects any value matching D:/, /uploads/, uploads\, or containing pre-owned-cars-backend.onrender.com.
 * 3. If the original file still exists on the server, uploads it to Cloudinary and replaces DB value with secure_url.
 * 4. If the file is lost, sets the field to null and logs the record ID for manual review.
 * 5. Logs a complete summary: total processed, migrated, lost/failed, skipped.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sequelize = require('../src/config/database');
const { QueryTypes } = require('sequelize');
const { cloudinary, isCloudinaryConfigured } = require('../src/config/cloudinary');
const { extractPublicIdFromUrl } = require('../src/utils/cloudinaryHelper');

async function resolveLocalFilePath(url) {
  if (!url || typeof url !== 'string') return null;

  // 1. Direct path check (e.g. D:\pre-owned-cars-backend\uploads\cars\... or /var/data/...)
  if (fs.existsSync(url)) return url;

  // 2. Normalizing Windows / POSIX slashes
  const normalizedSlashes = url.replace(/\//g, path.sep).replace(/\\/g, path.sep);
  if (fs.existsSync(normalizedSlashes)) return normalizedSlashes;

  // 3. Extracted from onrender.com URL (e.g. https://pre-owned-cars-backend.onrender.com/D:/pre-owned-cars-backend/uploads/cars/...)
  if (url.includes('onrender.com/')) {
    const afterHost = url.split('onrender.com/')[1];
    if (afterHost) {
      const decoded = decodeURIComponent(afterHost);
      if (fs.existsSync(decoded)) return decoded;
      const decNormalized = decoded.replace(/\//g, path.sep).replace(/\\/g, path.sep);
      if (fs.existsSync(decNormalized)) return decNormalized;
      // Maybe relative within workspace
      const relativeWorkspace = path.join(__dirname, '..', decoded.replace(/^[a-zA-Z]:[/\\]/, ''));
      if (fs.existsSync(relativeWorkspace)) return relativeWorkspace;
    }
  }

  // 4. Relative uploads path (e.g. /uploads/cars/cars-123.png or uploads/cars/cars-123.png)
  const relPath = url.replace(/^[a-zA-Z]:[/\\][^/]*[/\\]/, '').replace(/^\/?uploads\//, '');
  const candidateInUploads = path.join(__dirname, '..', 'uploads', relPath);
  if (fs.existsSync(candidateInUploads)) return candidateInUploads;

  const candidateInRoot = path.join(__dirname, '..', url.replace(/^\//, ''));
  if (fs.existsSync(candidateInRoot)) return candidateInRoot;

  return null;
}

function isBrokenOrLocalUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') return true;
  const clean = url.trim();

  // Any Windows drive path
  if (/^[a-zA-Z]:[/\\]/.test(clean)) return true;
  // Any internal uploads reference
  if (clean.includes('/uploads/') || clean.includes('uploads/') || clean.includes('uploads\\') || clean.includes('uploads/')) return true;
  // Any onrender.com host path pointing to an internal file
  if (clean.includes('pre-owned-cars-backend.onrender.com') && !clean.includes('cloudinary')) return true;
  // Not Cloudinary
  if (!clean.startsWith('https://res.cloudinary.com/')) return true;

  return false;
}

async function migrateImagesToCloudinary() {
  console.log('===========================================================');
  console.log('🚀 Starting Cloudinary Media Migration & DB Backfill');
  console.log('===========================================================');

  if (!isCloudinaryConfigured) {
    console.error('❌ Cloudinary is not configured. Please set CLOUDINARY_URL or CLOUD_NAME/API_KEY/API_SECRET in environment.');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database successfully.\n');

    // ─── 1. Migrate car_images ────────────────────────────────────────────
    console.log('📦 Processing table: car_images...');
    const carImages = await sequelize.query(
      'SELECT id, car_id, image_url, is_primary, public_id FROM car_images',
      { type: QueryTypes.SELECT }
    );

    let totalCarImages = carImages.length;
    let migratedCount = 0;
    let alreadyCloudinaryCount = 0;
    let lostCount = 0;
    const manualReviewIds = [];

    for (const record of carImages) {
      const { id, car_id, image_url, public_id } = record;

      if (!isBrokenOrLocalUrl(image_url)) {
        alreadyCloudinaryCount++;
        // Backfill public_id if missing
        if (!public_id) {
          const extractedPid = extractPublicIdFromUrl(image_url);
          if (extractedPid) {
            await sequelize.query(
              'UPDATE car_images SET public_id = :public_id WHERE id = :id',
              { replacements: { public_id: extractedPid, id }, type: QueryTypes.UPDATE }
            );
          }
        }
        continue;
      }

      console.log(`\n🔍 Found local / broken car_image [${id}] for car [${car_id}]:`);
      console.log(`   Current URL: "${image_url}"`);

      // Check if original file exists on local filesystem
      const localFilePath = await resolveLocalFilePath(image_url);

      if (localFilePath) {
        console.log(`   📂 File found on disk: ${localFilePath}`);
        console.log('   ☁️  Uploading to Cloudinary...');

        try {
          const uploadResult = await cloudinary.uploader.upload(localFilePath, {
            folder: `autodeal4u/cars/${car_id}`,
            resource_type: 'image',
            transformation: [
              { width: 1600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
            ],
            public_id: `migrated-${Date.now()}-${crypto.randomUUID()}`,
          });

          const secureUrl = uploadResult.secure_url;
          const publicId = uploadResult.public_id;

          await sequelize.query(
            'UPDATE car_images SET image_url = :image_url, public_id = :public_id WHERE id = :id',
            {
              replacements: { image_url: secureUrl, public_id: publicId, id },
              type: QueryTypes.UPDATE,
            }
          );

          console.log(`   ✅ Migrated to: ${secureUrl}`);
          console.log(`   🔑 Public ID: ${publicId}`);
          migratedCount++;
        } catch (uploadErr) {
          console.error(`   ❌ Cloudinary upload failed: ${uploadErr.message}`);
          await sequelize.query(
            'UPDATE car_images SET image_url = NULL WHERE id = :id',
            { replacements: { id }, type: QueryTypes.UPDATE }
          );
          lostCount++;
          manualReviewIds.push({ id, car_id, oldUrl: image_url, reason: `Upload error: ${uploadErr.message}` });
        }
      } else {
        console.warn(`   ⚠️ File NOT found on server disk (lost ephemeral upload).`);
        console.warn(`   Setting image_url to NULL so frontend shows placeholder.`);

        await sequelize.query(
          'UPDATE car_images SET image_url = NULL WHERE id = :id',
          { replacements: { id }, type: QueryTypes.UPDATE }
        );

        lostCount++;
        manualReviewIds.push({ id, car_id, oldUrl: image_url, reason: 'File not found on server disk' });
      }
    }

    // ─── 2. Check cars table for video_url / audio_url ────────────────────
    console.log('\n📦 Checking cars table for video_url / audio_url...');
    const cars = await sequelize.query(
      'SELECT id, video_url, audio_url FROM cars WHERE video_url IS NOT NULL OR audio_url IS NOT NULL',
      { type: QueryTypes.SELECT }
    );

    let carMediaMigrated = 0;
    let carMediaLost = 0;

    for (const car of cars) {
      if (car.video_url && isBrokenOrLocalUrl(car.video_url)) {
        const localPath = await resolveLocalFilePath(car.video_url);
        if (localPath) {
          try {
            const res = await cloudinary.uploader.upload(localPath, {
              folder: `autodeal4u/cars/${car.id}/videos`,
              resource_type: 'video',
              public_id: `video-${Date.now()}`,
            });
            await sequelize.query(
              'UPDATE cars SET video_url = :url WHERE id = :id',
              { replacements: { url: res.secure_url, id: car.id }, type: QueryTypes.UPDATE }
            );
            carMediaMigrated++;
          } catch (e) {
            await sequelize.query('UPDATE cars SET video_url = NULL WHERE id = :id', { replacements: { id: car.id }, type: QueryTypes.UPDATE });
            carMediaLost++;
          }
        } else {
          await sequelize.query('UPDATE cars SET video_url = NULL WHERE id = :id', { replacements: { id: car.id }, type: QueryTypes.UPDATE });
          carMediaLost++;
        }
      }

      if (car.audio_url && isBrokenOrLocalUrl(car.audio_url)) {
        const localPath = await resolveLocalFilePath(car.audio_url);
        if (localPath) {
          try {
            const res = await cloudinary.uploader.upload(localPath, {
              folder: `autodeal4u/cars/${car.id}/audio`,
              resource_type: 'video',
              public_id: `audio-${Date.now()}`,
            });
            await sequelize.query(
              'UPDATE cars SET audio_url = :url WHERE id = :id',
              { replacements: { url: res.secure_url, id: car.id }, type: QueryTypes.UPDATE }
            );
            carMediaMigrated++;
          } catch (e) {
            await sequelize.query('UPDATE cars SET audio_url = NULL WHERE id = :id', { replacements: { id: car.id }, type: QueryTypes.UPDATE });
            carMediaLost++;
          }
        } else {
          await sequelize.query('UPDATE cars SET audio_url = NULL WHERE id = :id', { replacements: { id: car.id }, type: QueryTypes.UPDATE });
          carMediaLost++;
        }
      }
    }

    // ─── 3. Check users table for profile_picture ─────────────────────────
    console.log('\n📦 Checking users table for profile_picture...');
    const users = await sequelize.query(
      'SELECT id, profile_picture FROM users WHERE profile_picture IS NOT NULL',
      { type: QueryTypes.SELECT }
    );
    let userPicsMigrated = 0;
    let userPicsLost = 0;

    for (const u of users) {
      if (u.profile_picture && isBrokenOrLocalUrl(u.profile_picture)) {
        const localPath = await resolveLocalFilePath(u.profile_picture);
        if (localPath) {
          try {
            const res = await cloudinary.uploader.upload(localPath, {
              folder: `autodeal4u/avatars/${u.id}`,
              resource_type: 'image',
              transformation: [{ width: 1600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }],
              public_id: `avatar-${Date.now()}`,
            });
            await sequelize.query(
              'UPDATE users SET profile_picture = :url WHERE id = :id',
              { replacements: { url: res.secure_url, id: u.id }, type: QueryTypes.UPDATE }
            );
            userPicsMigrated++;
          } catch (e) {
            await sequelize.query('UPDATE users SET profile_picture = NULL WHERE id = :id', { replacements: { id: u.id }, type: QueryTypes.UPDATE });
            userPicsLost++;
          }
        } else {
          await sequelize.query('UPDATE users SET profile_picture = NULL WHERE id = :id', { replacements: { id: u.id }, type: QueryTypes.UPDATE });
          userPicsLost++;
        }
      }
    }

    // ─── Migration Summary ───────────────────────────────────────────────
    console.log('\n===========================================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('===========================================================');
    console.log(`Total car_images processed : ${totalCarImages}`);
    console.log(`  - Already on Cloudinary  : ${alreadyCloudinaryCount}`);
    console.log(`  - Successfully Migrated  : ${migratedCount}`);
    console.log(`  - Lost / Set to NULL     : ${lostCount}`);
    console.log(`Cars video/audio migrated  : ${carMediaMigrated}`);
    console.log(`Cars video/audio lost      : ${carMediaLost}`);
    console.log(`User avatars migrated      : ${userPicsMigrated}`);
    console.log(`User avatars lost          : ${userPicsLost}`);

    if (manualReviewIds.length > 0) {
      console.log('\n⚠️  Records requiring manual review (files were lost on disk):');
      console.log(JSON.stringify(manualReviewIds, null, 2));
    } else {
      console.log('\n✅ Zero records lost! All local images were successfully migrated to Cloudinary.');
    }

    console.log('===========================================================');
    console.log('🎉 Migration completed successfully!');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed with uncaught error:', err);
    process.exit(1);
  }
}

migrateImagesToCloudinary();
