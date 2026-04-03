# TransactIQ — Real OTP Backend Setup Guide

## What this does
- Sends REAL OTP to mobile via Fast2SMS
- Sends REAL OTP to email via Gmail SMTP
- Stores users in MySQL with bcrypt-hashed passwords
- JWT session tokens, rate limiting, account lockout

---

## Step 1 — Install Node.js (if not installed)
Download from https://nodejs.org (LTS version)

---

## Step 2 — Install MySQL
Download from https://dev.mysql.com/downloads/installer/
Create a database:
```sql
CREATE DATABASE transactiq_db;
```

---

## Step 3 — Install project dependencies
```bash
cd transactiq-backend
npm install
```

---

## Step 4 — Configure .env

Copy the example file:
```bash
cp .env.example .env
```

Edit `.env` and fill in:

### MySQL
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=transactiq_db
```

### Fast2SMS (Mobile OTP)
1. Go to https://www.fast2sms.com
2. Sign up for FREE account
3. Dashboard → Dev API → Copy your API Key
4. Paste it in .env:
```
FAST2SMS_API_KEY=your_api_key_here
```
Free account gives ₹50 balance (~500 SMS)

### Gmail SMTP (Email OTP)
1. Go to your Google Account (myaccount.google.com)
2. Security → 2-Step Verification → Turn ON
3. Security → App Passwords
4. Select "Mail" → Select "Other" → Name it "TransactIQ"
5. Copy the 16-character password shown
6. Paste in .env:
```
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## Step 5 — Start the server
```bash
npm start
# or for auto-restart during development:
npm run dev
```

You should see:
```
✅ MySQL connected successfully
✅ All database tables ready
✅ Default admin created — username: admin / password: Admin@123
✅ Gmail SMTP connection verified
✅ TransactIQ Server running on http://localhost:5000
```

---

## Step 6 — Open the login page
Open `public/login.html` in your browser.

Or serve it with a simple static server:
```bash
npx serve public -p 3000
```
Then visit: http://localhost:3000/login.html

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/send-otp | Send OTP to email or mobile |
| POST | /api/auth/verify-register-otp | Verify OTP during registration |
| POST | /api/auth/login-otp | Login with OTP |
| POST | /api/auth/login-password | Login with username+password |
| POST | /api/auth/register | Register new user |
| GET | /api/auth/check-username/:name | Check username availability |
| GET | /api/user/profile | Get logged-in user profile |
| GET | /api/user/pending-approvals | Admin: list pending users |
| POST | /api/user/approve/:userId | Admin: approve user |
| POST | /api/user/reject/:userId | Admin: reject user |

---

## Default Admin Account
- Username: admin
- Password: Admin@123
- Email: admin@transactiq.com

Change the password after first login!

---

## Security Features
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens for session management
- Rate limiting on all OTP and login routes
- Account lockout after 5 failed attempts (5 min)
- OTP expires after 10 minutes
- OTP invalidated after use
- SQL injection prevention via prepared statements
- CORS configured for frontend origin only
- Helmet.js for HTTP security headers

---

## Project Structure
```
transactiq-backend/
├── server.js              ← Main entry point
├── package.json
├── .env.example           ← Copy to .env
├── config/
│   └── db.config.js       ← MySQL + table creation
├── controllers/
│   └── auth.controller.js ← All auth logic
├── routes/
│   ├── auth.routes.js     ← Auth endpoints
│   └── user.routes.js     ← User management
├── middleware/
│   └── auth.middleware.js ← JWT protection
├── services/
│   ├── otp.service.js     ← OTP generate, store, verify
│   ├── sms.service.js     ← Fast2SMS real SMS sender
│   └── email.service.js   ← Gmail SMTP real email sender
└── public/
    └── login.html         ← Frontend login page
```
