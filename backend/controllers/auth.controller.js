require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db.config');

function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET || 'transactiq2024secret', { expiresIn: '30d' });
}

async function generateUserUID(conn) {
  const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM users');
  return 'USR-' + String(rows[0].cnt + 1).padStart(4, '0');
}

// SEND OTP (kept for compatibility)
exports.sendOTP = async (req, res) => {
  res.json({ success: true, message: 'OTP feature disabled. Use password login.' });
};

exports.verifyRegisterOTP = async (req, res) => {
  res.json({ success: true, message: 'Verified' });
};

exports.loginWithOTP = async (req, res) => {
  res.status(400).json({ success: false, message: 'Please use password login' });
};

// LOGIN WITH USERNAME + PASSWORD
exports.loginWithPassword = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const conn = await pool.getConnection();
  try {
    const [users] = await conn.query(
      'SELECT * FROM users WHERE username = ? OR email = ? OR user_uid = ?',
      [username, username, username]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'User ID not found. Please register first.' });
    }

    const user = users[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact admin.' });
    }

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ success: false, message: `Account locked. Try again in ${mins} minute(s).`, locked: true });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const fails = (user.failed_login_attempts || 0) + 1;
      const lockUntil = fails >= 5 ? new Date(Date.now() + 5 * 60000) : null;
      await conn.query('UPDATE users SET failed_login_attempts=?, locked_until=? WHERE user_uid=?', [fails, lockUntil, user.user_uid]);
      const left = Math.max(0, 5 - fails);
      return res.status(401).json({ success: false, message: `Wrong password. ${left} attempt(s) remaining.` });
    }

    // Success
    await conn.query('UPDATE users SET failed_login_attempts=0, locked_until=NULL, last_login=NOW() WHERE user_uid=?', [user.user_uid]);
    const token = generateToken(user.user_uid, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        uid: user.user_uid,
        username: user.username,
        fullName: user.full_name,
        businessName: user.business_name,
        role: user.role,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  } finally {
    conn.release();
  }
};

// REGISTER — saves directly to MySQL, status = active immediately
exports.register = async (req, res) => {
  const { fullName, businessName, username, email, password, role } = req.body;

  if (!fullName) return res.status(400).json({ success: false, message: 'Full name is required' });
  if (!username) return res.status(400).json({ success: false, message: 'User ID is required' });
  if (!password) return res.status(400).json({ success: false, message: 'Password is required' });
  if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

  const conn = await pool.getConnection();
  try {
    // Check if username already exists
    const [existing] = await conn.query('SELECT user_uid FROM users WHERE username = ?', [username]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'User ID already taken. Please choose another.' });
    }

    // Check email if provided
    if (email) {
      const [emailCheck] = await conn.query('SELECT user_uid FROM users WHERE email = ?', [email]);
      if (emailCheck.length) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      }
    }

    const uid = await generateUserUID(conn);
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'user';

    // INSERT user — status is 'active' immediately, no pending
    await conn.query(
      `INSERT INTO users (user_uid, full_name, business_name, username, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [uid, fullName, businessName || fullName, username, email || null, passwordHash, userRole]
    );

    console.log(`✅ New user registered: ${username} (${uid})`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! You can now login.',
      userId: uid,
      username: username
    });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  } finally {
    conn.release();
  }
};

// CHECK USERNAME
exports.checkUsername = async (req, res) => {
  const { username } = req.params;
  if (!username || username.length < 3) {
    return res.json({ available: false, message: 'Minimum 3 characters' });
  }
  try {
    const [rows] = await pool.query('SELECT user_uid FROM users WHERE username = ?', [username]);
    res.json({ available: rows.length === 0, message: rows.length === 0 ? 'User ID available' : 'User ID already taken' });
  } catch (err) {
    res.json({ available: true, message: 'Could not check' });
  }
};
