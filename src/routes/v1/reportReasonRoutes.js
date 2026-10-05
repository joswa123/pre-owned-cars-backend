'use strict';

const express = require('express');
const router = express.Router();
const reportReasonController = require('../../controllers/reportReasonController');
const { cacheMiddleware } = require('../../middlewares/cacheMiddleware');

// ── Public Dropdown Endpoint ───────────────────────────────────────
// GET /api/v1/report-reasons & /api/report-reasons
router.get(
  '/',
  cacheMiddleware(300, { ignoreAuth: true }),
  reportReasonController.getPublicReasons
);

module.exports = router;
