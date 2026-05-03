const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.resend.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'resend',
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(to, code) {
  if (!process.env.SMTP_PASS) {
    console.log(`[SUPER ADMIN OTP] SMTP not configured. Code: ${code}`);
    return;
  }
  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'TokenEquityX <notifications@tokenequityx.co.zw>',
    to,
    subject: '[TokenEquityX] Super Admin OTP Verification',
    html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
      <h2 style="color:#1A3C5E">Super Admin Verification</h2>
      <p>Your one-time verification code:</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1A3C5E">${code}</span>
      </div>
      <p style="color:#666;font-size:14px">Expires in 10 minutes. Do not share this code.</p>
      <p style="color:#999;font-size:12px">TokenEquityX (Private) Limited &middot; tokenequityx.co.zw</p>
    </div>`,
  });
}
const crypto           = require('crypto');

const requireSuperAdmin = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT is_super_admin FROM users WHERE id = ?', [req.user.userId]);
    if (!rows.length || !rows[0].is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get('/status', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT is_super_admin FROM users WHERE id = ?', [req.user.userId]);
    res.json({ is_super_admin: rows[0]?.is_super_admin || false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/request-otp', authenticate, requireRole('ADMIN'), requireSuperAdmin, async (req, res) => {
  try {
    const [users] = await db.execute('SELECT email FROM users WHERE id = ?', [req.user.userId]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const email = users[0].email;
    const code  = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.execute("UPDATE otps SET used = TRUE WHERE user_id = ? AND used = FALSE AND purpose = 'SETTINGS_CHANGE'", [req.user.userId]);
    await db.execute("INSERT INTO otps (user_id, code, purpose, expires_at) VALUES (?, ?, 'SETTINGS_CHANGE', ?)", [req.user.userId, code, expiresAt.toISOString()]);
    await sendOtpEmail(email, code);
    res.json({ success: true, message: `OTP sent to ${email.replace(/(.{2}).*(@.*)/, '$1***$2')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-otp', authenticate, requireRole('ADMIN'), requireSuperAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'OTP code required' });
  try {
    const [rows] = await db.execute(
      "SELECT * FROM otps WHERE user_id = ? AND code = ? AND purpose = 'SETTINGS_CHANGE' AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [req.user.userId, code]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired OTP' });
    await db.execute('UPDATE otps SET used = TRUE WHERE id = ?', [rows[0].id]);
    res.json({ success: true, verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/sensitive-setting', authenticate, requireRole('ADMIN'), requireSuperAdmin, async (req, res) => {
  const { key, value, otpCode } = req.body;
  if (!key || value === undefined || !otpCode) return res.status(400).json({ error: 'key, value and otpCode required' });
  const SENSITIVE_KEYS = ['usdc_omnibus_wallet', 'stripe_secret_key', 'paynow_integration_key'];
  if (!SENSITIVE_KEYS.includes(key)) return res.status(400).json({ error: 'Not a sensitive setting' });
  try {
    const [rows] = await db.execute(
      "SELECT * FROM otps WHERE user_id = ? AND code = ? AND purpose = 'SETTINGS_CHANGE' AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [req.user.userId, otpCode]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired OTP' });
    await db.execute('UPDATE otps SET used = TRUE WHERE id = ?', [rows[0].id]);
    await db.execute('UPDATE platform_settings SET value = ?, updated_by = ?, updated_at = NOW() WHERE key = ?', [value, req.user.userId, key]);
    res.json({ success: true, message: `Setting '${key}' updated.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/grant', authenticate, requireRole('ADMIN'), requireSuperAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await db.execute("UPDATE users SET is_super_admin = TRUE WHERE id = ? AND role = 'ADMIN'", [userId]);
    res.json({ success: true, message: 'Super admin access granted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
