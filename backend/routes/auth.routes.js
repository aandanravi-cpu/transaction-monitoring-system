// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

// Strict rate limiter for OTP sending (max 5 per 15 min per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX) || 5,
  message: { success: false, message: 'Too many OTP requests. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ':' + (req.body?.contact || '')
});

// Login rate limiter (max 10 per 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please wait.' }
});

// Register rate limiter (max 3 per hour)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many registration attempts. Please wait.' }
});

// ── OTP Routes ──
router.post('/send-otp', otpLimiter, authController.sendOTP);
router.post('/verify-register-otp', otpLimiter, authController.verifyRegisterOTP);

// ── Login Routes ──
router.post('/login-otp', loginLimiter, authController.loginWithOTP);
router.post('/login-password', loginLimiter, authController.loginWithPassword);

// ── Register ──
router.post('/register', registerLimiter, authController.register);

// ── Utility ──
router.get('/check-username/:username', authController.checkUsername);

module.exports = router;
