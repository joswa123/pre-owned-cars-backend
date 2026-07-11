const express = require('express');
const router = express.Router();
const stateController = require('../../controllers/admin-stateController');
const validate = require('../../middlewares/validate');
const { addstateSchema } = require('../../validations/admin-stateValidation');

router.post('/add-state', validate(addstateSchema), stateController.createState);
router.get('/get-states', stateController.getStates);

module.exports = router;