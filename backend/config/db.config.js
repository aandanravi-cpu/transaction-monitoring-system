// config/db.config.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'transactiq_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function testDBConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    await createTables(conn);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    throw err;
  }
}

async function createTables(conn) {
  // Users table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_uid VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      business_name VARCHAR(150) NOT NULL,
      business_type VARCHAR(50),
      city VARCHAR(100),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(150) UNIQUE,
      mobile VARCHAR(15) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','user') DEFAULT 'user',
      status ENUM('pending','active','suspended') DEFAULT 'pending',
      gst_number VARCHAR(20),
      avatar VARCHAR(10) DEFAULT '🏪',
      failed_login_attempts INT DEFAULT 0,
      locked_until DATETIME NULL,
      last_login DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // OTP table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact VARCHAR(150) NOT NULL,
      contact_type ENUM('email','mobile') NOT NULL,
      otp_code VARCHAR(10) NOT NULL,
      purpose ENUM('login','register','reset') NOT NULL,
      attempts INT DEFAULT 0,
      is_used TINYINT(1) DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_contact (contact),
      INDEX idx_expires (expires_at)
    )
  `);

  // Sessions / tokens table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token_hash)
    )
  `);

  // Admin approval requests
  await conn.query(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      reviewed_by INT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      admin_note TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed default admin if not exists
  const bcrypt = require('bcryptjs');
  const [admins] = await conn.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (admins.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 12);
    await conn.query(`
      INSERT INTO users (user_uid, full_name, business_name, business_type, city, username, email, mobile, password_hash, role, status)
      VALUES ('USR-0001', 'System Admin', 'TransactIQ Admin', 'Service Provider', 'Trichy', 'admin', 'admin@transactiq.com', '9999999999', ?, 'admin', 'active')
    `, [hash]);
    console.log('✅ Default admin created — username: admin / password: Admin@123');
  }

  console.log('✅ All database tables ready');
}

module.exports = { pool, testDBConnection };
