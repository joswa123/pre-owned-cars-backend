const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const {
  createRequirementSchema,
  updateRequirementSchema,
  updateRequirementStatusSchema,
} = require('../../validations/requirementValidation');
const requirementController = require('../../controllers/requirementController');

// All routes require JWT authentication
router.use(protect);

router.post('/', validate(createRequirementSchema), requirementController.createRequirement);
router.get('/me', requirementController.getMyRequirements);
router.get('/:id', requirementController.getRequirement);
router.get('/:id/match-cars', requirementController.matchCars);
router.put('/:id', validate(updateRequirementSchema), requirementController.updateRequirement);
router.patch('/:id/status', validate(updateRequirementStatusSchema), requirementController.updateRequirementStatus);
router.delete('/:id', requirementController.deleteRequirement);

module.exports = router;
