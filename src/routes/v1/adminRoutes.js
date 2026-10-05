const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../../middlewares/auth");
const adminController = require("../../controllers/adminController");
const requirementController = require("../../controllers/requirementController");

// All routes require authentication and admin role
router.use(protect, adminOnly);

// ── Traffic & Stats ────────────────────────────────────────────────────────────
// GET /api/v1/admin/traffic  — app usage stats (registered users vs guests)
router.get("/requirements", requirementController.getAllRequirementsForAdmin);
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

// ── Users Approval Flow ──────────────────────────────────────────────────────
// GET   /api/v1/admin/users/pending/count — count of pending users
// GET   /api/v1/admin/users/pending       — paginated pending users list
// PATCH /api/v1/admin/users/:id/approve   — approve pending user
// PATCH /api/v1/admin/users/:id/reject    — reject user account
router.get("/users/pending/count", adminController.getPendingUsersCount);
router.get("/users/pending", adminController.getPendingUsers);
router.patch("/users/:id/approve", adminController.approveUser);
router.patch("/users/:id/reject", adminController.rejectUser);

// ── Subscriptions & Payments (future) ────────────────────────────────────────
router.get("/subscriptions", adminController.getSubscriptions);
router.get("/payments", adminController.getPayments);

// ── Car Reports ───────────────────────────────────────────────────────────────
const carReportController = require("../../controllers/carReportController");
const validate = require("../../middlewares/validate");
const { updateCarReportStatusSchema } = require("../../validations/carReportValidation");

router.get("/car-reports", carReportController.getReports);
router.get("/car-reports/:id", carReportController.getReportById);
router.patch("/car-reports/:id", validate(updateCarReportStatusSchema, { allowUnknown: false }), carReportController.updateReportStatus);
router.get("/reports", carReportController.getReports);
router.get("/reports/:id", carReportController.getReportById);
router.patch("/reports/:id", validate(updateCarReportStatusSchema, { allowUnknown: false }), carReportController.updateReportStatus);

module.exports = router;
