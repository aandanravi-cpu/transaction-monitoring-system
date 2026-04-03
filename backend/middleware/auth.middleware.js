// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db.config');

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token. Please login.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await pool.query(
      'SELECT id, user_uid, username, full_name, business_name, role, status FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!users.length) return res.status(401).json({ success: false, message: 'User not found' });
    if (users[0].status !== 'active') return res.status(403).json({ success: false, message: 'Account not active' });
    req.user = users[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};
