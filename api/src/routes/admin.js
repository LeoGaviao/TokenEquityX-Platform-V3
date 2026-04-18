const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');

// GET /api/admin/stats — platform statistics
router.get('/stats',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [[users]]     = await db.execute('SELECT COUNT(*) as count FROM users');
      const [[tokens]]    = await db.execute('SELECT COUNT(*) as count FROM tokens');
      const [[kyc]]       = await db.execute("SELECT COUNT(*) as count FROM kyc_records WHERE status = 'PENDING'");
      const [[trades]]    = await db.execute('SELECT COUNT(*) as count, COALESCE(SUM(total_usdc),0) as volume FROM trades');
      const [[orders]]    = await db.execute("SELECT COUNT(*) as count FROM orders WHERE status = 'OPEN'");
      const [[dividends]] = await db.execute('SELECT COUNT(*) as count FROM dividend_rounds');

      res.json({
        users:          users.count,
        tokens:         tokens.count,
        pendingKYC:     kyc.count,
        totalTrades:    trades.count,
        totalVolume:    trades.volume,
        openOrders:     orders.count,
        dividendRounds: dividends.count
      });
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch stats' });
    }
  }
);

// GET /api/admin/users — list all users
router.get('/users',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT u.id, u.wallet_address, u.email, u.role,
               u.kyc_status, u.created_at, u.last_login
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 100
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch users' });
    }
  }
);

// PUT /api/admin/users/:id/role — update user role
router.put('/users/:id/role',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { role } = req.body;
    const validRoles = ['INVESTOR','ISSUER','AUDITOR','COMPLIANCE_OFFICER','PARTNER','ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      await db.execute(
       'UPDATE users SET role = ?, kyc_status = ? WHERE id = ?',
       [role, 'APPROVED', req.params.id]
      );
      logger.info('User role updated', {
        targetId: req.params.id, role,
        updatedBy: req.user.userId
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not update role' });
    }
  }
);

// GET /api/admin/audit-logs — recent audit logs
router.get('/audit-logs',
  authenticate,
  requireRole('ADMIN','AUDITOR'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT al.*, u.wallet_address
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 200
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch audit logs' });
    }
  }
);

// PUT /api/admin/market-controls/:tokenId — update market controls
router.put('/market-controls/:tokenId',
  authenticate,
  requireRole('ADMIN','COMPLIANCE_OFFICER'),
  async (req, res) => {
    const {
      tradingEnabled, halted, haltReason,
      dailyVolumeCapUSD, maxTradeSizeUSD
    } = req.body;

    try {
      await db.execute(`
        INSERT INTO market_controls
          (token_id, halted, halt_reason,
           daily_volume_cap_usd, max_trade_size_usd)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (token_id) DO UPDATE SET
          halted               = EXCLUDED.halted,
          halt_reason          = EXCLUDED.halt_reason,
          daily_volume_cap_usd = EXCLUDED.daily_volume_cap_usd,
          max_trade_size_usd   = EXCLUDED.max_trade_size_usd,
          updated_at           = NOW()
      `, [
        req.params.tokenId,
        halted ? true : false,
        haltReason || '',
        dailyVolumeCapUSD || 0,
        maxTradeSizeUSD || 0
      ]);

      if (halted) {
        await db.execute(
          "UPDATE tokens SET market_state = 'HALTED' WHERE id = ?",
          [req.params.tokenId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not update market controls' });
    }
  }
);
// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { suspended } = req.body;
    try {
      await db.execute(
        'UPDATE users SET account_status = ? WHERE id = ?',
        [suspended ? 'SUSPENDED' : 'ACTIVE', req.params.id]
      );
      logger.info('User suspension updated', {
        targetId: req.params.id, suspended,
        updatedBy: req.user.userId
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not update suspension status' });
    }
  }
);
// POST /api/admin/staff — create auditor, DFI or admin account
router.post('/staff',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { full_name, email, password, role } = req.body;
    const allowedRoles = ['AUDITOR', 'DFI', 'ADMIN', 'COMPLIANCE_OFFICER'];
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password and role are required' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const hash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      await db.execute(
        `INSERT INTO users (id, full_name, email, password_hash, role, kyc_status, onboarding_complete, account_status)
         VALUES (?, ?, ?, ?, ?, 'APPROVED', 1, 'ACTIVE')`,
        [id, full_name, email, hash, role]
      );
      logger.info('Staff account created', { targetId: id, role, createdBy: req.user.userId });
      res.status(201).json({ success: true, message: `${role} account created for ${email}` });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      res.status(500).json({ error: 'Failed to create staff account' });
    }
  }
);
module.exports = router;