// api/src/routes/profile.js
const router   = require('express').Router();
const db       = require('../db/pool');
const bcrypt   = require('bcryptjs');
const upload   = require('../middleware/upload');
const { uploadToSupabase } = require('../middleware/upload');
const { authenticate }     = require('../middleware/auth');

// GET /api/profile — get current user profile
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, email, full_name, role, kyc_status, account_status,
              wallet_address, wallet, phone, profile_photo_url, bio,
              country, city, date_of_birth, is_active,
              deactivation_requested, onboarding_complete,
              created_at, last_login
       FROM users WHERE id = ?`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    delete user.password_hash;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch profile: ' + err.message });
  }
});

// PUT /api/profile — update profile fields
router.put('/', authenticate, async (req, res) => {
  const { full_name, phone, bio, country, city, date_of_birth } = req.body;
  try {
    await db.execute(
      `UPDATE users SET
         full_name    = COALESCE(?, full_name),
         phone        = COALESCE(?, phone),
         bio          = COALESCE(?, bio),
         country      = COALESCE(?, country),
         city         = COALESCE(?, city),
         date_of_birth = COALESCE(?::DATE, date_of_birth),
         updated_at   = NOW()
       WHERE id = ?`,
      [full_name || null, phone || null, bio || null,
       country || null, city || null, date_of_birth || null,
       req.user.userId]
    );
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not update profile: ' + err.message });
  }
});

// POST /api/profile/photo — upload profile photo
router.post('/photo', authenticate, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  try {
    const uploaded = await uploadToSupabase(req.file, 'profile-photos', req.user.userId);
    await db.execute(
      'UPDATE users SET profile_photo_url = ?, updated_at = NOW() WHERE id = ?',
      [uploaded.url, req.user.userId]
    );
    res.json({ success: true, url: uploaded.url });
  } catch (err) {
    res.status(500).json({ error: 'Could not upload photo: ' + err.message });
  }
});

// PUT /api/profile/password — change password
router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  try {
    const [rows] = await db.execute(
      'SELECT password_hash FROM users WHERE id = ?', [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [hash, req.user.userId]
    );
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not change password: ' + err.message });
  }
});

// POST /api/profile/deactivate — request account deactivation
router.post('/deactivate', authenticate, async (req, res) => {
  const { reason, password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password confirmation is required' });
  try {
    const [rows] = await db.execute(
      'SELECT password_hash, role FROM users WHERE id = ?', [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Password is incorrect' });
    if (rows[0].role === 'ADMIN') {
      return res.status(403).json({ error: 'Admin accounts cannot be self-deactivated. Contact system administrator.' });
    }
    await db.execute(
      `UPDATE users SET
         deactivation_requested = TRUE,
         deactivation_reason    = ?,
         updated_at             = NOW()
       WHERE id = ?`,
      [reason || null, req.user.userId]
    );
    // Notify admin
    const { sendMessage } = require('../utils/messenger');
    const [adminRows] = await db.execute(
      "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE LIMIT 1"
    );
    if (adminRows.length > 0) {
      await sendMessage({
        recipientId: adminRows[0].id,
        subject:     '⚠️ Account Deactivation Request',
        body:        `User ${req.user.userId} (${req.user.email || 'unknown'}) has requested account deactivation. Reason: ${reason || 'Not specified'}. Please review and process from the Users section.`,
        type:        'SYSTEM',
        category:    'GENERAL',
      }).catch(() => {});
    }
    res.json({ success: true, message: 'Deactivation request submitted. An administrator will process your request within 2 business days.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit deactivation request: ' + err.message });
  }
});

module.exports = router;
