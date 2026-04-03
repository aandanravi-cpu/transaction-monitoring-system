// services/email.service.js — Gmail SMTP Real OTP Sender
const nodemailer = require('nodemailer');

// Create Gmail transporter using App Password
// (NOT your regular Gmail password — use App Password)
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,       // TLS
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD   // 16-char App Password from Google
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Send OTP via Gmail SMTP
 * Setup: Google Account → Security → 2-Step Verification → App Passwords
 */
async function sendEmailOTP(emailAddress, otp, recipientName = '') {
  try {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      throw new Error('Invalid email address');
    }

    const transporter = createTransporter();
    const expiryMins = process.env.OTP_EXPIRY_MINUTES || 10;
    const name = recipientName || emailAddress.split('@')[0];

    const mailOptions = {
      from: {
        name: 'TransactIQ Security',
        address: process.env.GMAIL_USER
      },
      to: emailAddress,
      subject: `${otp} is your TransactIQ verification code`,
      text: `Your TransactIQ OTP is: ${otp}\nValid for ${expiryMins} minutes.\nDo not share this with anyone.`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#0b0e17;padding:28px 36px;text-align:center">
            <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">
              Transact<span style="color:#00c97a">IQ</span>
            </div>
            <div style="color:#64748b;font-size:13px;margin-top:4px">Transaction Monitoring System</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 20px">
            <p style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px">Hello, ${name}!</p>
            <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 28px">
              We received a request to verify your identity for TransactIQ. Use the OTP below to complete verification.
            </p>

            <!-- OTP Box -->
            <div style="text-align:center;margin:0 0 28px">
              <div style="display:inline-block;background:#f0fdf4;border:2px solid #00c97a44;border-radius:12px;padding:20px 40px">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Your OTP Code</div>
                <div style="font-size:42px;font-weight:800;color:#00c97a;letter-spacing:12px;font-family:'Courier New',monospace">${otp}</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:8px">Valid for ${expiryMins} minutes</div>
              </div>
            </div>

            <!-- Warning -->
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin-bottom:24px">
              <p style="font-size:13px;color:#92400e;margin:0">
                <strong>Security Notice:</strong> Never share this OTP with anyone. TransactIQ will never call or ask for your OTP. If you did not request this, please ignore this email.
              </p>
            </div>

            <p style="font-size:13px;color:#94a3b8;margin:0">
              This OTP will expire at <strong>${new Date(Date.now() + expiryMins * 60000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center">
            <p style="font-size:12px;color:#94a3b8;margin:0">
              © 2024 TransactIQ — BCA Final Year Project<br>
              This is an automated message. Please do not reply.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email OTP sent to ${emailAddress} — Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      message: `OTP sent to ${emailAddress.replace(/(.{2}).*(@.*)/, '$1****$2')}`
    };

  } catch (err) {
    console.error('❌ Gmail SMTP error:', err.message);
    throw new Error('Failed to send email OTP: ' + err.message);
  }
}

// Test SMTP connection on startup
async function verifyEmailConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Gmail SMTP connection verified');
    return true;
  } catch (err) {
    console.warn('⚠️  Gmail SMTP not configured yet:', err.message);
    return false;
  }
}

module.exports = { sendEmailOTP, verifyEmailConnection };
