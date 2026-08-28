const { carQuerySchema } = require('./src/validations/carValidation');

console.log('1. has_wishlist: true ->', !carQuerySchema.validate({ has_wishlist: true }).error);
console.log('2. has_wishlist: "true" ->', !carQuerySchema.validate({ has_wishlist: 'true' }).error);
console.log('3. has_wishlist: false ->', !carQuerySchema.validate({ has_wishlist: false }).error);
console.log('4. has_wishlist: "false" ->', !carQuerySchema.validate({ has_wishlist: 'false' }).error);
console.log('5. min_wishlist: 3 ->', !carQuerySchema.validate({ min_wishlist: 3 }).error);
console.log('6. min_wishlist: -1 -> error:', !!carQuerySchema.validate({ min_wishlist: -1 }).error);
console.log('7. has_wishlist: "maybe" -> error:', !!carQuerySchema.validate({ has_wishlist: 'maybe' }).error);
console.log('All schema assertions complete.');
