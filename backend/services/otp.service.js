// services/otp.service.js — OTP Generation, Storage & Verification
const crypto = require('crypto');
const { pool } = require('../config/db.config');
const { sendEmailOTP } = require('./email.service');
const { sendMobileOTP } = require('./sms.service');

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
const MAX_ATTEMPTS = parseInt(process.env.MAX_OTP_ATTEMPTS) || 5;

// Generate a secure numeric OTP
function generateOTP() {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  // Use crypto for secure random
  const range = max - min + 1;
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0);
  return String(min + (num % range));
}

/**
 * Create OTP, store in DB, and send via email or SMS
 */
async function createAndSendOTP(contact, contactType, purpose, recipientName = '') {
  const conn = await pool.getConnection();
  try {
    // Invalidate any existing unused OTPs for this contact+purpose
    await conn.query(
      `UPDATE otp_tokens SET is_used = 1 
       WHERE contact = ? AND contact_type = ? AND purpose = ? AND is_used = 0`,
      [contact, contactType, purpose]
    );

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY * 60 * 1000);

    // Store in DB
    await conn.query(
      `INSERT INTO otp_tokens (contact, contact_type, otp_code, purpose, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [contact, contactType, otp, purpose, expiresAt]
    );

    // Send OTP via appropriate channel
    let sendResult;
    if (contactType === 'email') {
      sendResult = await sendEmailOTP(contact, otp, recipientName);
    } else if (contactType === 'mobile') {
      sendResult = await sendMobileOTP(contact, otp);
    } else {
      throw new Error('Invalid contact type');
    }

    return {
      success: true,
      message: sendResult.message,
      expiresAt: expiresAt.toISOString()
    };

  } catch (err) {
    // If send failed, remove the stored OTP
    await conn.query(
      `UPDATE otp_tokens SET is_used = 1 
       WHERE contact = ? AND purpose = ? AND is_used = 0`,
      [contact, purpose]
    ).catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Verify OTP entered by user
 */
async function verifyOTP(contact, contactType, enteredOTP, purpose) {
  const conn = await pool.getConnection();
  try {
    // Fetch latest valid OTP
    const [rows] = await conn.query(
      `SELECT * FROM otp_tokens 
       WHERE contact = ? AND contact_type = ? AND purpose = ? 
         AND is_used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [contact, contactType, purpose]
    );

    if (rows.length === 0) {
      return { success: false, message: 'OTP expired or not found. Please request a new OTP.' };
    }

    const record = rows[0];

    // Check max attempts
    if (record.attempts >= MAX_ATTEMPTS) {
      await conn.query(`UPDATE otp_tokens SET is_used = 1 WHERE id = ?`, [record.id]);
      return { success: false, message: 'Too many incorrect attempts. Please request a new OTP.' };
    }

    // Verify OTP value
    if (record.otp_code !== String(enteredOTP)) {
      // Increment attempts
      await conn.query(`UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?`, [record.id]);
      const remaining = MAX_ATTEMPTS - record.attempts - 1;
      return {
        success: false,
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
        attemptsLeft: remaining
      };
    }

    // OTP is correct — mark as used
    await conn.query(`UPDATE otp_tokens SET is_used = 1 WHERE id = ?`, [record.id]);

    return { success: true, message: 'OTP verified successfully' };

  } finally {
    conn.release();
  }
}

// Cleanup expired OTPs (run periodically)
async function cleanupExpiredOTPs() {
  try {
    const [result] = await pool.query(
      `DELETE FROM otp_tokens WHERE expires_at < NOW() OR is_used = 1`
    );
    if (result.affectedRows > 0) {
      console.log(`🧹 Cleaned up ${result.affectedRows} expired OTP records`);
    }
  } catch (err) {
    console.error('OTP cleanup error:', err.message);
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupExpiredOTPs, 30 * 60 * 1000);

module.exports = { createAndSendOTP, verifyOTP };
