// routes/transaction.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { pool } = require('../config/db.config');

// Create transactions table if not exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      txn_id VARCHAR(100) UNIQUE NOT NULL,
      user_uid VARCHAR(20) NOT NULL,
      sender VARCHAR(100),
      sender_mobile VARCHAR(15),
      sender_location VARCHAR(100),
      receiver VARCHAR(100),
      receiver_mobile VARCHAR(15),
      receiver_location VARCHAR(100),
      amount DECIMAL(12,2) NOT NULL,
      type ENUM('Credit','Debit','Pending','Transfer') DEFAULT 'Credit',
      method VARCHAR(50),
      category VARCHAR(50),
      status VARCHAR(20) DEFAULT 'Completed',
      txn_date DATETIME,
      ref_note TEXT,
      fraud_flags TEXT,
      flag_status VARCHAR(30) DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
ensureTable().catch(console.error);

// GET all transactions for logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM transactions WHERE user_uid = ? ORDER BY txn_date DESC',
      [req.user.user_uid]
    );
    res.json({ success: true, transactions: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add new transaction
router.post('/', protect, async (req, res) => {
  const { txnId, sender, senderMobile, senderLocation, receiver, receiverMobile, receiverLocation,
    amount, type, method, category, status, date, note, fraudFlags, flagStatus } = req.body;
  if (!txnId || !amount) return res.status(400).json({ success: false, message: 'Transaction ID and amount required' });
  try {
    // Check duplicate txn_id for this user
    const [existing] = await pool.query('SELECT id FROM transactions WHERE txn_id = ? AND user_uid = ?', [txnId, req.user.user_uid]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Transaction ID already exists' });
    await pool.query(
      `INSERT INTO transactions (txn_id, user_uid, sender, sender_mobile, sender_location, receiver, receiver_mobile, receiver_location, amount, type, method, category, status, txn_date, ref_note, fraud_flags, flag_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txnId, req.user.user_uid, sender, senderMobile||'', senderLocation||'', receiver, receiverMobile||'', receiverLocation||'',
       amount, type||'Credit', method||'UPI', category||'Other', status||'Completed',
       date || new Date(), note||'', JSON.stringify(fraudFlags||[]), flagStatus||'none']
    );
    res.status(201).json({ success: true, message: 'Transaction saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update flag status (mark normal/fraud)
router.put('/:txnId/flag', protect, async (req, res) => {
  const { flagStatus } = req.body;
  try {
    await pool.query(
      'UPDATE transactions SET flag_status = ?, fraud_flags = ? WHERE txn_id = ? AND user_uid = ?',
      [flagStatus, flagStatus === 'confirmed_normal' ? '[]' : req.body.fraudFlags || '[]',
       req.params.txnId, req.user.user_uid]
    );
    res.json({ success: true, message: 'Flag updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT edit transaction
router.put('/:txnId', protect, async (req, res) => {
  const { sender, senderMobile, receiver, receiverMobile, amount, type, method, category, status, note } = req.body;
  try {
    await pool.query(
      `UPDATE transactions SET sender=?, sender_mobile=?, receiver=?, receiver_mobile=?, amount=?, type=?, method=?, category=?, status=?, ref_note=? WHERE txn_id=? AND user_uid=?`,
      [sender, senderMobile||'', receiver, receiverMobile||'', amount, type, method, category, status, note||'', req.params.txnId, req.user.user_uid]
    );
    res.json({ success: true, message: 'Transaction updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE single transaction
router.delete('/:txnId', protect, async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE txn_id = ? AND user_uid = ?', [req.params.txnId, req.user.user_uid]);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE multiple transactions
router.post('/delete-many', protect, async (req, res) => {
  const { txnIds } = req.body;
  if (!txnIds || !txnIds.length) return res.status(400).json({ success: false, message: 'No IDs provided' });
  try {
    const placeholders = txnIds.map(() => '?').join(',');
    await pool.query(
      `DELETE FROM transactions WHERE txn_id IN (${placeholders}) AND user_uid = ?`,
      [...txnIds, req.user.user_uid]
    );
    res.json({ success: true, message: txnIds.length + ' transactions deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
