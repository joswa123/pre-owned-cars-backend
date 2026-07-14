const express = require('express');
const path = require('path');

// Import your main app
const app = require('../src/app'); // adjust path

// Vercel expects a serverless function that exports a handler
module.exports = (req, res) => {
  // If you have your app already exported from app.js, just call it
  app(req, res);
};