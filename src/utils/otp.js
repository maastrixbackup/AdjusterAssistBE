// utils/otp.util.js
const crypto = require('crypto');

/**
 * Generates a secure 6-digit numeric OTP
 */
const generateOTP = () => {
    // Generates a random number between 100000 and 999999
    return crypto.randomInt(100000, 999999).toString();
};

module.exports = { generateOTP };