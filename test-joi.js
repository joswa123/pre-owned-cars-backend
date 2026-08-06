const Joi = require('joi');
const schema = Joi.object({
  board_type: Joi.string().trim().uppercase().valid('OWN BOARD', 'T-BOARD', 'COMMERCIAL').required()
});

const result1 = schema.validate({ board_type: 'Own Board' });
console.log('Result 1 (Own Board):', result1);

const result2 = schema.validate({ board_type: 'own board' });
console.log('Result 2 (own board):', result2);

const result3 = schema.validate({ board_type: 'T-board' });
console.log('Result 3 (T-board):', result3);
