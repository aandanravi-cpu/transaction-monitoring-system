const jwt = require('jsonwebtoken');
const { pool } = require('../config/db.config');

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token. Please login.' });
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'transactiq2024secret');
    } catch (jwtErr) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token. Please login again.' });
    }

    // Try find by id first
    let users = [];
    try {
      const [rows] = await pool.query(
        'SELECT id, user_uid, username, full_name, business_name, role, status FROM users WHERE id = ?',
        [decoded.id]
      );
      users = rows;
    } catch(dbErr) {
      console.error('DB error in protect:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'User not found. Please login again.' });
    }

    if (users[0].status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended.' });
    }

    req.user = users[0];
    next();
  } catch (err) {
    console.error('Protect middleware error:', err.message);
    return res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};
