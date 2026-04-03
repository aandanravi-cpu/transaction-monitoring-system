// services/sms.service.js — Fast2SMS Real OTP Sender
const axios = require('axios');

/**
 * Send OTP via Fast2SMS (India)
 * Free signup: https://www.fast2sms.com
 * Get API key: Dashboard → Dev API → Copy API Key
 */
async function sendMobileOTP(mobileNumber, otp) {
  try {
    // Validate mobile number
    const cleanMobile = String(mobileNumber).replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      throw new Error('Invalid mobile number — must be 10 digits');
    }

    const message = `Your TransactIQ verification code is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share this OTP with anyone. - TransactIQ`;

    // Fast2SMS API call
    const response = await axios({
      method: 'POST',
      url: 'https://www.fast2sms.com/dev/bulkV2',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        route: 'q',           // Transactional route (for OTP)
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanMobile
      },
      timeout: 10000
    });

    if (response.data && response.data.return === true) {
      console.log(`✅ SMS OTP sent to +91${cleanMobile} — Request ID: ${response.data.request_id}`);
      return {
        success: true,
        requestId: response.data.request_id,
        message: `OTP sent to +91${cleanMobile.slice(0,2)}XXXXXXXX${cleanMobile.slice(-2)}`
      };
    } else {
      throw new Error(response.data?.message || 'Fast2SMS returned failure');
    }

  } catch (err) {
    // Log full error for debugging
    console.error('❌ Fast2SMS error:', err.response?.data || err.message);

    // Return user-friendly error
    const msg = err.response?.data?.message || err.message;
    throw new Error('Failed to send SMS OTP: ' + msg);
  }
}

module.exports = { sendMobileOTP };
