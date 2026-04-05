const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { pool } = require('../config/db.config');

// GET /api/user/profile
router.get('/profile', protect, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/user/all-users (admin only)
router.get('/all-users', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_uid, full_name, business_name, username, email, role, status, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('all-users error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/user/pending-approvals (admin only)
router.get('/pending-approvals', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_uid, full_name, business_name, username, email, role, status, created_at FROM users WHERE status = ? ORDER BY created_at ASC',
      ['pending']
    );
    res.json({ success: true, count: rows.length, requests: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/user/approve/:userId (admin only)
router.post('/approve/:userId', protect, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE users SET status = ? WHERE id = ?', ['active', req.params.userId]);
    res.json({ success: true, message: 'User approved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/user/reject/:userId (admin only)
router.post('/reject/:userId', protect, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE users SET status = ? WHERE id = ?', ['suspended', req.params.userId]);
    res.json({ success: true, message: 'User suspended' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/user/delete/:userId (admin only)
router.delete('/delete/:userId', protect, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.userId]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
