const { initializeApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

let adminApp = null;

if (!getApps().length) {
  try {
    // 1. Try Environment variables first
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Clean up the private key (handle literal \n and accidental quotes)
      let rawKey = process.env.FIREBASE_PRIVATE_KEY;
      if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
        rawKey = rawKey.slice(1, -1);
      }
      const privateKey = rawKey.replace(/\\n/g, '\n').trim();

      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log('✅ Firebase Admin initialized (via environment variables)');
    } else {
      // 2. Fall back to local JSON file
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized (via firebase-service-account.json)');
      } else {
        // 3. If neither works
        console.warn('⚠️ Firebase Admin not initialized: Missing environment variables and firebase-service-account.json');
      }
    }
  } catch (err) {
    console.warn(`⚠️ Firebase Admin initialization skipped due to error: ${err.message}`);
  }
} else {
  adminApp = getApps()[0];
}

module.exports = adminApp;
