const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notificationController');
const { protect } = require('../../middlewares/auth');

router.use(protect);

router.route('/')
  .get(notificationController.getNotifications);

router.route('/read-all')
  .patch(notificationController.markAllAsRead);

router.route('/:id/read')
  .patch(notificationController.markAsRead);

module.exports = router;
