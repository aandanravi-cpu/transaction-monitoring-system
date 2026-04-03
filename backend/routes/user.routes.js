// routes/user.routes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { pool } = require('../config/db.config');

// GET /api/user/profile
router.get('/profile', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// GET /api/user/pending-approvals  (admin only)
router.get('/pending-approvals', protect, adminOnly, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.user_uid, u.full_name, u.business_name, u.business_type,
            u.city, u.username, u.email, u.mobile, u.created_at,
            a.id as request_id, a.requested_at
     FROM users u
     JOIN approval_requests a ON a.user_id = u.id
     WHERE u.status = 'pending' AND a.status = 'pending'
     ORDER BY a.requested_at ASC`
  );
  res.json({ success: true, count: rows.length, requests: rows });
});

// POST /api/user/approve/:userId  (admin only)
router.post('/approve/:userId', protect, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE users SET status = 'active' WHERE id = ?`, [userId]);
    await conn.query(
      `UPDATE approval_requests SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?
       WHERE user_id = ? AND status = 'pending'`,
      [req.user.id, userId]
    );
    await conn.commit();
    res.json({ success: true, message: 'User approved successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Approval failed' });
  } finally {
    conn.release();
  }
});

// POST /api/user/reject/:userId  (admin only)
router.post('/reject/:userId', protect, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE users SET status = 'suspended' WHERE id = ?`, [userId]);
    await conn.query(
      `UPDATE approval_requests SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?, admin_note = ?
       WHERE user_id = ? AND status = 'pending'`,
      [req.user.id, reason || '', userId]
    );
    await conn.commit();
    res.json({ success: true, message: 'User rejected' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Rejection failed' });
  } finally {
    conn.release();
  }
});

// GET /api/user/all-users  (admin only)
router.get('/all-users', protect, adminOnly, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, user_uid, full_name, business_name, username, email, mobile, role, status, created_at, last_login
     FROM users ORDER BY created_at DESC`
  );
  res.json({ success: true, users: rows });
});

module.exports = router;
