const Joi = require('joi');
const { createCarSchema, mapToDbValues } = require('./src/validations/carValidation');

const reqBody = {
  model: 'Innova',
  variant: 'ZX',
  year: 2020,
  price: 2500000,
  transmission: 'manual',
  ownership: '1st owner',
  board_type: 'Own Board'
};

const { error, value } = createCarSchema.validate(reqBody, { abortEarly: false });

console.log('Joi Error:', error ? error.details : null);
console.log('Joi Value:', value);

if (!error) {
  const dbValues = mapToDbValues(value);
  console.log('Mapped DB Values:', dbValues);
}
