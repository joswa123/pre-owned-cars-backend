const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const {
  createRequirementSchema,
  updateRequirementStatusSchema,
} = require('../../validations/requirementValidation');
const requirementController = require('../../controllers/requirementController');

// All routes require JWT authentication
router.use(protect);

router.post('/', validate(createRequirementSchema), requirementController.createRequirement);
router.get('/me', requirementController.getMyRequirements);
router.patch('/:id/status', validate(updateRequirementStatusSchema), requirementController.updateRequirementStatus);
router.delete('/:id', requirementController.deleteRequirement);

module.exports = router;
