const { initializeApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

let adminApp = null;

if (!getApps().length) {
  try {
    // Development: load from local JSON file
    if (process.env.NODE_ENV === 'production') {
      // Production: load from environment variables
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
        console.log('✅ Firebase Admin initialized (Production Env Vars)');
      } else {
        console.warn('⚠️ Firebase Admin not initialized: Missing production environment variables');
      }
    } else {
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized (Local JSON)');
      } else {
         console.warn(`⚠️ Firebase Admin not initialized: Missing service account file at ${serviceAccountPath}`);
      }
    }
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
} else {
  adminApp = getApps()[0];
}

module.exports = adminApp;
