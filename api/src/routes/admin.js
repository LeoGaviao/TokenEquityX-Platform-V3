const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }         = require('../middleware/auth');
const { requireRole }          = require('../middleware/roles');
const { getReconEmailStatus }  = require('../utils/validateReconEmails');
const { sendReconciliationEmail } = require('../utils/mailer');
const { invalidateCache }      = require('../utils/platformSettings');

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
// ── DELETE /api/admin/listings/:tokenSymbol — hard-delete a listing ──────────
// Deletes all platform records for a token. Requires ?confirm=true to execute.
router.delete('/listings/:tokenSymbol',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const sym = (req.params.tokenSymbol || '').toUpperCase().trim();
    if (!sym) return res.status(400).json({ error: 'tokenSymbol is required' });
    if (req.query.confirm !== 'true') {
      return res.status(400).json({
        error: 'Safety check failed: add ?confirm=true to proceed with permanent deletion',
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const counts = {};

      // 1. token_holdings
      const [h] = await conn.execute('DELETE FROM token_holdings WHERE token_symbol = ?', [sym]);
      counts.token_holdings = h.rowCount ?? h.affectedRows ?? 0;

      // 2. offering_subscriptions (by symbol or via offering_id FK)
      const [os] = await conn.execute(`
        DELETE FROM offering_subscriptions
        WHERE token_symbol = ?
           OR offering_id IN (SELECT id FROM primary_offerings WHERE token_symbol = ?)
      `, [sym, sym]);
      counts.offering_subscriptions = os.rowCount ?? os.affectedRows ?? 0;

      // 3. primary_offerings
      const [po] = await conn.execute('DELETE FROM primary_offerings WHERE token_symbol = ?', [sym]);
      counts.primary_offerings = po.rowCount ?? po.affectedRows ?? 0;

      // 4. p2p_offers
      const [p2p] = await conn.execute('DELETE FROM p2p_offers WHERE token_symbol = ?', [sym]);
      counts.p2p_offers = p2p.rowCount ?? p2p.affectedRows ?? 0;

      // 5. settlement_instructions (only if column exists)
      try {
        const [si] = await conn.execute('DELETE FROM settlement_instructions WHERE token_symbol = ?', [sym]);
        counts.settlement_instructions = si.rowCount ?? si.affectedRows ?? 0;
      } catch { counts.settlement_instructions = 0; }

      // 6. wht_batches
      try {
        const [wb] = await conn.execute('DELETE FROM wht_batches WHERE token_symbol = ?', [sym]);
        counts.wht_batches = wb.rowCount ?? wb.affectedRows ?? 0;
      } catch { counts.wht_batches = 0; }

      // 7. spv_annual_fees
      try {
        const [sf] = await conn.execute('DELETE FROM spv_annual_fees WHERE token_symbol = ?', [sym]);
        counts.spv_annual_fees = sf.rowCount ?? sf.affectedRows ?? 0;
      } catch { counts.spv_annual_fees = 0; }

      // 8. audit_logs — target_entity matches token symbol or submission id; best-effort
      try {
        const [al] = await conn.execute('DELETE FROM audit_logs WHERE target_entity = ?', [sym]);
        counts.audit_logs = al.rowCount ?? al.affectedRows ?? 0;
      } catch { counts.audit_logs = 0; }

      // 9. application_fees
      try {
        const [af] = await conn.execute('DELETE FROM application_fees WHERE token_symbol = ?', [sym]);
        counts.application_fees = af.rowCount ?? af.affectedRows ?? 0;
      } catch { counts.application_fees = 0; }

      // 10. data_submissions — fetch issuer_wallet before delete so we can notify
      const [subRows] = await conn.execute(
        'SELECT issuer_wallet, entity_name FROM data_submissions WHERE token_symbol = ? LIMIT 1', [sym]
      );
      const issuerWallet = subRows[0]?.issuer_wallet || null;
      const entityName   = subRows[0]?.entity_name   || sym;

      const [ds] = await conn.execute('DELETE FROM data_submissions WHERE token_symbol = ?', [sym]);
      counts.data_submissions = ds.rowCount ?? ds.affectedRows ?? 0;

      // 11. tokens
      const [tk] = await conn.execute('DELETE FROM tokens WHERE token_symbol = ?', [sym]);
      counts.tokens = tk.rowCount ?? tk.affectedRows ?? 0;

      await conn.commit();

      // Audit log (insert after commit so it isn't deleted above)
      try {
        await db.execute(
          'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
          ['HARD_DELETE_LISTING', req.user.userId, sym,
           `Admin permanently deleted all records for ${sym}. Deleted: ${JSON.stringify(counts)}`]
        );
      } catch {}

      // Notify issuer if we found one
      if (issuerWallet) {
        try {
          const { sendMessage } = require('../utils/messenger');
          await sendMessage({
            recipientId: issuerWallet,
            subject:     `❌ Listing Removed — ${sym}`,
            body:        `Your tokenisation listing for ${entityName} (${sym}) has been permanently removed from the TokenEquityX platform by the platform administrator. All associated records, documents, and data have been deleted. If you believe this was done in error, please contact platform support.`,
            type:        'SYSTEM',
            category:    'APPLICATION',
          });
        } catch (notifyErr) {
          console.warn('[HARD-DELETE] Issuer notification failed (non-fatal):', notifyErr.message);
        }
      }

      res.json({
        success: true,
        tokenSymbol: sym,
        message: `${sym} and all associated records permanently deleted from the platform.`,
        deleted: counts,
      });
    } catch (err) {
      await conn.rollback();
      console.error('[HARD-DELETE] Error:', err);
      res.status(500).json({ error: 'Hard delete failed: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── Reconciliation audit, preview, fix & settings ────────────────────────────

// Helper: collect all ledger metrics in one place (used by audit + preview)
async function collectLedgerMetrics() {
  const [orphans]       = await db.execute(`
    SELECT dr.id, dr.user_id, dr.amount_usd, dr.created_at, dr.notes
    FROM deposit_requests dr
    LEFT JOIN users u ON u.id = dr.user_id
    WHERE dr.status = 'CONFIRMED' AND u.id IS NULL
    ORDER BY dr.created_at ASC
  `);
  const [depActiveRows] = await db.execute(`
    SELECT COALESCE(SUM(dr.amount_usd), 0) AS total
    FROM deposit_requests dr JOIN users u ON u.id = dr.user_id
    WHERE dr.status = 'CONFIRMED'
  `);
  const [depAllRows]    = await db.execute(
    "SELECT COALESCE(SUM(amount_usd), 0) AS total FROM deposit_requests WHERE status = 'CONFIRMED'"
  );
  const [wdRows]        = await db.execute(
    "SELECT COALESCE(SUM(amount_usd), 0) AS total FROM withdrawal_requests WHERE status = 'COMPLETED'"
  );
  const [walRows]       = await db.execute('SELECT COALESCE(SUM(balance_usd), 0) AS total FROM investor_wallets');
  const [ledRows]       = await db.execute('SELECT COALESCE(SUM(amount_usd), 0) AS total FROM wallet_transactions');
  const [treasuryRows]  = await db.execute('SELECT COALESCE(SUM(usd_liability), 0) AS total FROM platform_treasury');
  const [voidedRows]    = await db.execute(
    "SELECT COALESCE(SUM(amount_usd), 0) AS total, COUNT(*) AS count FROM deposit_requests WHERE status = 'VOIDED'"
  );
  const [txTypeRows]    = await db.execute(`
    SELECT type, COUNT(*) AS count, COALESCE(SUM(amount_usd), 0) AS total
    FROM wallet_transactions GROUP BY type ORDER BY ABS(COALESCE(SUM(amount_usd), 0)) DESC
  `);
  const [imttRefundRows]= await db.execute(
    "SELECT COALESCE(SUM(amount_usd), 0) AS total, COUNT(*) AS count FROM wallet_transactions WHERE type = 'REFUND' AND description ILIKE '%IMTT%'"
  );
  const [nonDepRows]    = await db.execute(`
    SELECT type, COALESCE(SUM(amount_usd), 0) AS total, COUNT(*) AS count
    FROM wallet_transactions WHERE amount_usd > 0 AND type NOT IN ('DEPOSIT','TRADE_SELL')
    GROUP BY type ORDER BY total DESC
  `);
  const [dupeRows]      = await db.execute(`
    SELECT reference_id, type, COUNT(*) AS count, COALESCE(SUM(amount_usd), 0) AS total
    FROM wallet_transactions WHERE reference_id IS NOT NULL
    GROUP BY reference_id, type HAVING COUNT(*) > 1 ORDER BY count DESC LIMIT 20
  `);

  const confirmedDeposits    = parseFloat(depActiveRows[0].total);
  const confirmedDepositsAll = parseFloat(depAllRows[0].total);
  const completedWithdrawals = parseFloat(wdRows[0].total);
  const expectedBalance      = confirmedDeposits - completedWithdrawals;
  const actualBalance        = parseFloat(walRows[0].total);
  const ledgerNet            = parseFloat(ledRows[0].total);
  const treasuryLiability    = parseFloat(treasuryRows[0].total);
  const variance             = actualBalance - expectedBalance;
  const ledgerGap            = Math.abs(ledgerNet - actualBalance);
  const orphanedTotal        = orphans.reduce((s, r) => s + parseFloat(r.amount_usd), 0);
  const imttRefundTotal      = parseFloat(imttRefundRows[0].total);
  const imttRefundCount      = parseInt(imttRefundRows[0].count);
  const voidedTotal          = parseFloat(voidedRows[0].total);
  const voidedCount          = parseInt(voidedRows[0].count);
  const unexplainedCredits   = nonDepRows
    .filter(r => r.type !== 'REFUND')
    .reduce((s, r) => s + parseFloat(r.total), 0);

  return {
    orphans,
    orphanedCount:          orphans.length,
    orphanedTotal,
    confirmedDeposits,
    confirmedDepositsAll,
    completedWithdrawals,
    expectedBalance,
    actualBalance,
    ledgerNet,
    treasuryLiability,
    variance,
    varianceAbs:            Math.abs(variance),
    varianceDirection:      variance > 0.01 ? 'EXCESS' : variance < -0.01 ? 'SHORTFALL' : 'OK',
    ledgerGap,
    voidedTotal,
    voidedCount,
    txTypeBreakdown:        txTypeRows.map(r => ({ type: r.type, count: Number(r.count), total: parseFloat(r.total) })),
    imttRefundTotal,
    imttRefundCount,
    nonDepositCredits:      nonDepRows.map(r => ({ type: r.type, count: Number(r.count), total: parseFloat(r.total) })),
    unexplainedCredits,
    duplicates:             dupeRows.map(r => ({ referenceId: r.reference_id, type: r.type, count: Number(r.count), total: parseFloat(r.total) })),
    duplicateCount:         dupeRows.length,
  };
}

// GET /api/admin/reconciliation-audit
router.get('/reconciliation-audit',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [metrics, emailStatus] = await Promise.all([
        collectLedgerMetrics(),
        getReconEmailStatus(),
      ]);
      res.json({
        ...metrics,
        emailStatus,
        toolStatus: emailStatus.canOperate ? 'OPERATIONAL' : 'DISABLED',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/admin/reconciliation-preview
// Returns the exact changes that would be made — no DB writes.
router.post('/reconciliation-preview',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const emailStatus = await getReconEmailStatus();
      if (!emailStatus.canOperate) {
        return res.status(403).json({
          error:           'RECONCILIATION_EMAILS_NOT_CONFIGURED',
          message:         'Reconciliation fix is disabled. Notification emails must be configured before any ledger adjustments.',
          details:         emailStatus.errors,
          requiredEnvVars: ['RECONCILIATION_EMAIL_PRIMARY', 'RECONCILIATION_EMAIL_SECONDARY'],
        });
      }

      const [orphans] = await db.execute(`
        SELECT id, user_id, amount_usd, created_at
        FROM deposit_requests
        WHERE status = 'CONFIRMED' AND user_id NOT IN (SELECT id FROM users)
        ORDER BY created_at ASC
      `);

      const totalAmount = orphans.reduce((s, r) => s + parseFloat(r.amount_usd), 0);

      res.json({
        fixId:       'orphaned_deposits',
        changes:     orphans,
        totalAmount,
        recipients:  emailStatus.recipients,
        description: `Will void ${orphans.length} CONFIRMED deposit(s) totalling $${totalAmount.toFixed(2)} for deleted investor accounts`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/admin/reconciliation-fix
// Executes the fix: voids orphaned deposits, logs to audit_logs, sends email.
// Requires { reason, confirmed: true } in body.
router.post('/reconciliation-fix',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { reason, confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({ error: 'confirmed must be true — submit via the confirmation step' });
    }
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'reason is required and must be at least 10 characters' });
    }

    // Block fix if notification emails are not configured
    const emailStatus = await getReconEmailStatus();
    if (!emailStatus.canOperate) {
      return res.status(403).json({
        error:           'RECONCILIATION_EMAILS_NOT_CONFIGURED',
        message:         'Reconciliation fix is disabled. Notification emails must be configured before any ledger adjustments.',
        details:         emailStatus.errors,
        requiredEnvVars: ['RECONCILIATION_EMAIL_PRIMARY', 'RECONCILIATION_EMAIL_SECONDARY'],
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [orphans] = await conn.execute(`
        SELECT id, user_id, amount_usd, created_at
        FROM deposit_requests
        WHERE status = 'CONFIRMED' AND user_id NOT IN (SELECT id FROM users)
      `);

      if (orphans.length === 0) {
        await conn.rollback();
        return res.json({ success: true, voided: 0, amount: 0, message: 'No orphaned deposits found — ledger is already clean.' });
      }

      const totalAmount  = orphans.reduce((s, r) => s + parseFloat(r.amount_usd), 0);
      const confirmedAt  = new Date().toISOString();

      // Fetch performer email for notification subject
      const [adminRows]  = await conn.execute('SELECT email FROM users WHERE id = ?', [req.user.userId]);
      const fixedByEmail = adminRows[0]?.email || req.user.userId;

      // Void the deposits
      await conn.execute(`
        UPDATE deposit_requests
        SET status = 'VOIDED',
            notes  = CONCAT(COALESCE(notes, ''), ' | VOIDED: investor account deleted — reconciliation gap closed ', NOW()::date)
        WHERE status = 'CONFIRMED'
          AND user_id NOT IN (SELECT id FROM users)
      `);

      // Comprehensive audit log entry
      await conn.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        [
          'RECONCILIATION_FIX',
          req.user.userId,
          'reconciliation',
          JSON.stringify({
            fixId:           'orphaned_deposits',
            reason:          reason.trim(),
            changes:         orphans.map(o => ({ id: o.id, user_id: o.user_id, amount_usd: parseFloat(o.amount_usd) })),
            totalAmount,
            emailRecipients: emailStatus.recipients,
            emailStatus:     'PENDING',
            confirmed_at:    confirmedAt,
            performed_by:    fixedByEmail,
          }),
        ]
      );

      await conn.commit();

      // Send notification emails (after commit — non-fatal if email fails)
      const emailResults = await sendReconciliationEmail({
        fixId:       'orphaned_deposits',
        reason:      reason.trim(),
        changes:     orphans,
        totalAmount,
        fixedByEmail,
        recipients:  emailStatus.recipients,
        confirmedAt,
      });

      const emailFailed = emailResults.some(r => !r.success);
      const emailStatusStr = emailFailed
        ? (emailResults.some(r => r.success) ? 'PARTIAL_FAILURE' : 'FAILED')
        : 'SENT';

      // Update audit log with final email status
      await db.execute(
        `UPDATE audit_logs SET details = details::jsonb || $1::jsonb
         WHERE action = 'RECONCILIATION_FIX' AND performed_by = $2
         ORDER BY id DESC LIMIT 1`,
        [JSON.stringify({ emailStatus: emailStatusStr, emailResults }), req.user.userId]
      ).catch(() => {}); // Non-fatal — main audit entry already written

      res.json({
        success:      true,
        voided:       orphans.length,
        amount:       totalAmount,
        emailStatus:  emailStatusStr,
        emailResults,
        recipients:   emailStatus.recipients,
        message:      `Voided ${orphans.length} orphaned deposit(s) totalling $${totalAmount.toFixed(2)}. Notifications ${emailStatusStr === 'SENT' ? 'sent to' : 'attempted for'}: ${emailStatus.recipients.join(', ')}.`,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      conn.release();
    }
  }
);

// GET /api/admin/reconciliation-settings — current email config (ADMIN+)
router.get('/reconciliation-settings',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const emailStatus = await getReconEmailStatus();
      res.json(emailStatus);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/admin/reconciliation-settings — update email config (SUPER_ADMIN only)
router.put('/reconciliation-settings',
  authenticate,
  requireRole('SUPER_ADMIN'),
  async (req, res) => {
    const { primary, secondary, tertiary } = req.body;
    try {
      const upsert = async (key, value) => {
        await db.execute(
          `INSERT INTO platform_settings (key, value, updated_by, updated_at)
           VALUES (?, ?, ?, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [key, (value || '').trim(), req.user.userId]
        );
      };
      await upsert('reconciliation_email_primary',   primary);
      await upsert('reconciliation_email_secondary', secondary);
      await upsert('reconciliation_email_tertiary',  tertiary);
      invalidateCache();

      const updated = await getReconEmailStatus();
      res.json({ success: true, ...updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;