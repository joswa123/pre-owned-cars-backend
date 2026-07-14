const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../../middlewares/auth');
const modelController = require('../../../controllers/modelController');

// All routes require authentication and admin role
router.use(protect, adminOnly);

router.post('/', modelController.createModel);
router.put('/:id', modelController.updateModel);
router.delete('/:id', modelController.deleteModel);

module.exports = router;