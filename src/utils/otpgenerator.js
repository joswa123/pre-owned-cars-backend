const crypto = require('crypto');

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const sendOtpViaSms = async (phone, otp) => {
  // Mock SMS sending – in production use Twilio, AWS SNS, etc.
  console.log(`📱 Sending OTP ${otp} to ${phone}`);
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
};

module.exports = { generateOtp, sendOtpViaSms };