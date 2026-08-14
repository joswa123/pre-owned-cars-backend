const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../../middlewares/auth");
const adminController = require("../../controllers/adminController");

// All routes require authentication and admin role
router.use(protect, adminOnly);

// ── Traffic & Stats ────────────────────────────────────────────────────────────
// GET /api/v1/admin/traffic  — app usage stats (registered users vs guests)
router.get("/traffic", adminController.getTrafficStats);

// ── Enquiries ─────────────────────────────────────────────────────────────────
// GET /api/v1/admin/enquiries  — all lead/enquiry details across the platform
router.get("/enquiries", adminController.getAllEnquiries);

// ── Dealers ──────────────────────────────────────────────────────────────────
// GET /api/v1/admin/dealers        — paginated dealer list (filter by status, search)
// GET /api/v1/admin/dealers/:id    — single dealer full profile
// GET /api/v1/admin/dealers/:dealerId/cars — all cars for a specific dealer
router.get("/dealers", adminController.getDealers);
router.get("/dealers/:id", adminController.getDealerById);
router.get("/dealers/:dealerId/cars", adminController.getDealerCars);

// ── Subscriptions & Payments (future) ────────────────────────────────────────
router.get("/subscriptions", adminController.getSubscriptions);
router.get("/payments", adminController.getPayments);

module.exports = router;
