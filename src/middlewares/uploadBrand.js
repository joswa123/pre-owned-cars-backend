/**
 * Multer Configuration for Brand Image Uploads
 * 
 * Purpose: This file configures how brand images are received, validated, 
 * and saved to the local server disk when a user or admin uploads them.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Purpose: Ensure the target directory exists before we try to save files there.
// This prevents the server from crashing the very first time someone uploads an image.
const brandDir = 'uploads/brands/';
if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

// Purpose: Define exactly HOW and WHERE the uploaded file should be saved on the server.
const storage = multer.diskStorage({
  // Purpose: Set the destination folder for the uploaded files
  destination: (req, file, cb) => {
    cb(null, brandDir);
  },
  
  // Purpose: Create a unique filename to prevent overwriting existing images 
  // (e.g., if two users upload a file named "logo.jpg" at the same time).
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9); // Generate unique ID
    const ext = path.extname(file.originalname); // Get original extension (.png, .jpg)
    cb(null, `brand-${unique}${ext}`); // Result: "brand-1690000000000-123456789.png"
  }
});

// Purpose: Security & Validation. Restrict uploads to ONLY valid image formats.
// This prevents users from uploading malicious files (like .exe or .php scripts) disguised as images.
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  
  // Check 1: Does the file extension match allowed types?
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  // Check 2: Does the actual file MIME type match allowed types? (Double security check)
  const mime = allowed.test(file.mimetype);
  
  if (mime && ext) return cb(null, true); // Accept file
  
  // Reject file and send an error message back to the frontend
  cb(new Error('Only image files are allowed'), false);
};

// Purpose: Initialize the Multer middleware with our specific rules.
const upload = multer({
  storage, // Use our custom disk storage logic above
  limits: { 
    // Purpose: Prevent Denial of Service (DoS) attacks by limiting file size.
    // Defaults to 5MB if MAX_FILE_SIZE is not set in the .env file.
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 
  },
  fileFilter // Apply our image-only security filter above
});

// Purpose: Export the configured middleware so it can be used in our route files.
// Usage example in routes: router.post('/', upload.single('image'), controller.createBrand)
module.exports = upload;