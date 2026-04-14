// api/src/routes/auth.js
// Email/password auth + MetaMask auth (both supported)
// New: signup, role-select, onboarding, staff creation

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tokenequityx_jwt_secret_2026';

// ── Helper ──────────────────────────────────────────────────────
function makeToken(user) {
  return jwt.sign(
    { userId: user.id, wallet: user.wallet, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── POST /api/auth/signup ────────────────────────────────────────
// Public signup: name + email + password
// Role is set in the next step (role-select)
router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Check email not already used
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: 'An account with this email already exists' });

    const id           = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);

    await db.execute(
      `INSERT INTO users (id, wallet, role, kyc_status, email, full_name, password_hash, is_active, onboarding_complete)
       VALUES (?, ?, 'INVESTOR', 'PENDING', ?, ?, ?, 1, 0)`,
      [id, `email_${id.slice(0,8)}`, email.toLowerCase(), full_name, password_hash]
    );

    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user   = rows[0];
    const token  = makeToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id, role: user.role, email: user.email,
        full_name: user.full_name, kyc_status: user.kyc_status,
        onboarding_complete: user.onboarding_complete
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────
// Email/password login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase()]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    if (!user.password_hash)
      return res.status(401).json({ error: 'This account uses wallet login. Please connect MetaMask.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    // Update last login
    await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = makeToken(user);
    res.json({
      token,
      user: {
        id: user.id, role: user.role, email: user.email,
        full_name: user.full_name, kyc_status: user.kyc_status,
        onboarding_complete: user.onboarding_complete,
        wallet: user.wallet
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/role-select ───────────────────────────────────
// After signup: user selects their role (INVESTOR, ISSUER, PARTNER)
router.post('/role-select', authenticate, async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['INVESTOR', 'ISSUER', 'PARTNER'];
    if (!allowed.includes(role))
      return res.status(400).json({ error: 'Invalid role. Choose: INVESTOR, ISSUER, or PARTNER' });

    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, req.user.userId]);

    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    const user   = rows[0];
    const token  = makeToken(user); // re-issue token with new role

    res.json({ token, user: { id: user.id, role: user.role, email: user.email, full_name: user.full_name } });
  } catch (err) {
    console.error('Role select error:', err);
    res.status(500).json({ error: 'Failed to set role' });
  }
});

// ── POST /api/auth/complete-onboarding ──────────────────────────
// Mark onboarding as complete (after KYC docs uploaded)
router.post('/complete-onboarding', authenticate, async (req, res) => {
  try {
    await db.execute(
      'UPDATE users SET onboarding_complete = 1 WHERE id = ?',
      [req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, wallet, role, kyc_status, email, full_name, is_active, onboarding_complete, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ── POST /api/auth/connect-wallet ───────────────────────────────
// Existing MetaMask users — keep working as before
router.post('/connect-wallet', async (req, res) => {
  try {
    const { wallet, signature } = req.body;
    if (!wallet) return res.status(400).json({ error: 'Wallet address required' });

    let [rows] = await db.execute('SELECT * FROM users WHERE wallet = ?', [wallet]);
    let user;

    if (rows.length === 0) {
      // Auto-register new wallet user
      const id = uuidv4();
      await db.execute(
        `INSERT INTO users (id, wallet, role, kyc_status, is_active)
         VALUES (?, ?, 'INVESTOR', 'PENDING', 1)`,
        [id, wallet]
      );
      [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    }
    user = rows[0];
    await db.execute('UPDATE users SET last_login = NOW(), wallet_address = ? WHERE id = ?', [wallet, user.id]);

    const token = makeToken(user);
    res.json({
      token,
      user: { id: user.id, role: user.role, wallet: user.wallet, kyc_status: user.kyc_status }
    });
  } catch (err) {
    console.error('Wallet connect error:', err);
    res.status(500).json({ error: 'Wallet connection failed' });
  }
});

// ── POST /api/auth/create-staff (ADMIN only) ────────────────────
// Admin creates auditor, DFI, or another admin account
router.post('/create-staff', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { full_name, email, role, password } = req.body;
    const allowed_roles = ['ADMIN', 'AUDITOR', 'DFI', 'COMPLIANCE_OFFICER'];

    if (!full_name || !email || !role || !password)
      return res.status(400).json({ error: 'Name, email, role and password are required' });
    if (!allowed_roles.includes(role))
      return res.status(400).json({ error: 'Invalid staff role' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email already registered' });

    const id           = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);

    await db.execute(
      `INSERT INTO users (id, wallet, role, kyc_status, email, full_name, password_hash, is_active, onboarding_complete)
       VALUES (?, ?, ?, 'APPROVED', ?, ?, ?, 1, 1)`,
      [id, `staff_${id.slice(0,8)}`, role, email.toLowerCase(), full_name, password_hash]
    );

    res.status(201).json({
      success: true,
      user: { id, role, email: email.toLowerCase(), full_name }
    });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// ── GET /api/auth/staff-list (ADMIN only) ───────────────────────
router.get('/staff-list', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, email, full_name, role, kyc_status, is_active, created_at, last_login
       FROM users WHERE role IN ('ADMIN','AUDITOR','DFI','COMPLIANCE_OFFICER')
       ORDER BY role, full_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
});

// ── DELETE /api/auth/staff/:id (ADMIN only) ─────────────────────
router.delete('/staff/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    if (req.params.id === req.user.userId)
      return res.status(400).json({ error: 'Cannot deactivate your own account' });

    await db.execute(
      'UPDATE users SET is_active = 0 WHERE id = ? AND role IN (\'ADMIN\',\'AUDITOR\',\'DFI\',\'COMPLIANCE_OFFICER\')',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

module.exports = router;
