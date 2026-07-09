const User = require('./User');
const Otp = require('./Otp');

// Associations
User.hasOne(Otp, { foreignKey: 'user_id', as: 'otpRecord' });
Otp.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { User, Otp };