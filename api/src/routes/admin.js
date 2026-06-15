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

// ── Adjustment transaction audit & reversal ───────────────────────────────────

// GET /api/admin/adjustment-audit
// Returns all ADJUSTMENT wallet transactions with wallet impact for review.
router.get('/adjustment-audit',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [adjustments] = await db.execute(`
        SELECT
          wt.id, wt.user_id, wt.amount_usd, wt.description,
          wt.reference_id, wt.created_at, wt.balance_before, wt.balance_after,
          u.email, u.full_name,
          iw.balance_usd AS current_wallet_balance
        FROM wallet_transactions wt
        LEFT JOIN users u ON u.id = wt.user_id
        LEFT JOIN investor_wallets iw ON iw.user_id = wt.user_id
        WHERE wt.type = 'ADJUSTMENT'
        ORDER BY wt.created_at DESC
      `);

      // Also check for existing reversals so UI can flag already-reversed records
      const [reversals] = await db.execute(`
        SELECT reference_id FROM wallet_transactions WHERE type = 'ADJUSTMENT_REVERSAL'
      `);
      const reversedIds = new Set(reversals.map(r => r.reference_id));

      const [walRows] = await db.execute(
        'SELECT COALESCE(SUM(balance_usd), 0) AS total FROM investor_wallets'
      );
      const [ledRows] = await db.execute(
        'SELECT COALESCE(SUM(amount_usd), 0) AS total FROM wallet_transactions'
      );
      const walletTotal  = parseFloat(walRows[0].total);
      const ledgerNet    = parseFloat(ledRows[0].total);
      const ledgerGap    = Math.abs(ledgerNet - walletTotal);

      res.json({
        adjustments: adjustments.map(a => ({
          ...a,
          amount_usd:       parseFloat(a.amount_usd),
          balance_before:   parseFloat(a.balance_before),
          balance_after:    parseFloat(a.balance_after),
          current_wallet_balance: parseFloat(a.current_wallet_balance || 0),
          already_reversed: reversedIds.has(a.id),
        })),
        totalAdjustmentCredits:  adjustments.filter(a => parseFloat(a.amount_usd) > 0).reduce((s, a) => s + parseFloat(a.amount_usd), 0),
        totalAdjustmentDebits:   adjustments.filter(a => parseFloat(a.amount_usd) < 0).reduce((s, a) => s + parseFloat(a.amount_usd), 0),
        reversalCount:     reversals.length,
        walletTotal,
        ledgerNet,
        ledgerGap,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/admin/adjustment-reversal
// Creates counter-transactions for the specified ADJUSTMENT records.
// Body: { ids: ['uuid',...], reason: string (>=10 chars), confirmed: true }
router.post('/adjustment-reversal',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { ids, reason, confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({ error: 'confirmed must be true' });
    }
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'reason is required and must be at least 10 characters' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array of adjustment transaction UUIDs' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Load the target adjustment records, guard against wrong type or already reversed
      const placeholders = ids.map(() => '?').join(',');
      const [targets] = await conn.execute(
        `SELECT wt.id, wt.user_id, wt.amount_usd, wt.description, wt.type
         FROM wallet_transactions wt
         WHERE wt.id IN (${placeholders}) AND wt.type = 'ADJUSTMENT'`,
        ids
      );

      if (targets.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'No ADJUSTMENT records found for the provided IDs' });
      }

      // Check none are already reversed
      const [existingReversals] = await conn.execute(
        `SELECT reference_id FROM wallet_transactions WHERE type = 'ADJUSTMENT_REVERSAL' AND reference_id IN (${placeholders})`,
        ids
      );
      if (existingReversals.length > 0) {
        await conn.rollback();
        return res.status(400).json({
          error: `${existingReversals.length} of the selected adjustment(s) already have reversals. Re-run the audit to see current state.`,
          already_reversed: existingReversals.map(r => r.reference_id),
        });
      }

      const reversalIds  = [];
      const variances    = [];

      for (const adj of targets) {
        const originalAmount = parseFloat(adj.amount_usd);
        const reversalAmount = -originalAmount; // opposite sign

        // Fetch current wallet balance for accurate before/after
        const [walletRows] = await conn.execute(
          'SELECT balance_usd FROM investor_wallets WHERE user_id = ?',
          [adj.user_id]
        );
        if (walletRows.length === 0) {
          // Wallet deleted — skip balance update but still create the reversal ledger entry
          await conn.execute(
            `INSERT INTO wallet_transactions
               (user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
             VALUES (?, 'ADJUSTMENT_REVERSAL', ?, 0, 0, ?, ?)`,
            [
              adj.user_id,
              reversalAmount,
              adj.id,
              `Reversal of incorrect adjustment #${adj.id.slice(0, 8)}: ${adj.description || 'no description'}`,
            ]
          );
          reversalIds.push({ original_id: adj.id, reversal_amount: reversalAmount, wallet_update: 'skipped — wallet not found' });
          continue;
        }

        const balanceBefore = parseFloat(walletRows[0].balance_usd);
        const balanceAfter  = parseFloat((balanceBefore + reversalAmount).toFixed(2));

        // Create counter-transaction in the ledger
        const [inserted] = await conn.execute(
          `INSERT INTO wallet_transactions
             (user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
           VALUES (?, 'ADJUSTMENT_REVERSAL', ?, ?, ?, ?, ?)
           RETURNING id`,
          [
            adj.user_id,
            reversalAmount,
            balanceBefore,
            balanceAfter,
            adj.id,
            `Reversal of incorrect adjustment #${adj.id.slice(0, 8)}: ${adj.description || 'no description'}`,
          ]
        );

        // Correct the wallet balance
        await conn.execute(
          'UPDATE investor_wallets SET balance_usd = balance_usd + ?, updated_at = NOW() WHERE user_id = ?',
          [reversalAmount, adj.user_id]
        );

        reversalIds.push({
          original_id:     adj.id,
          reversal_id:     inserted[0]?.id,
          original_amount: originalAmount,
          reversal_amount: reversalAmount,
          balance_before:  balanceBefore,
          balance_after:   balanceAfter,
        });
        variances.push({ user_id: adj.user_id, amount: originalAmount });
      }

      const totalReversed = targets.reduce((s, a) => s + Math.abs(parseFloat(a.amount_usd)), 0);

      // Comprehensive audit log entry
      await conn.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        [
          'RECONCILIATION_ADJUSTMENT_REVERSAL',
          req.user.userId,
          'wallet_transactions',
          JSON.stringify({
            original_adjustments: targets.map(a => ({ id: a.id, user_id: a.user_id, amount_usd: parseFloat(a.amount_usd), description: a.description })),
            reversals:            reversalIds,
            reason:               reason.trim(),
            total_reversed:       totalReversed,
            reason_detail:        'Incorrect sign on original adjustment — debits applied as credits',
            fixed_at:             new Date().toISOString(),
            performed_by:         req.user.userId,
          }),
        ]
      );

      await conn.commit();

      // Post-commit ledger integrity check
      const [walRows] = await db.execute('SELECT COALESCE(SUM(balance_usd), 0) AS total FROM investor_wallets');
      const [ledRows] = await db.execute('SELECT COALESCE(SUM(amount_usd), 0) AS total FROM wallet_transactions');
      const walletTotal = parseFloat(walRows[0].total);
      const ledgerNet   = parseFloat(ledRows[0].total);
      const ledgerGap   = Math.abs(ledgerNet - walletTotal);

      res.json({
        success:        true,
        reversals:      reversalIds,
        totalReversed,
        walletTotal,
        ledgerNet,
        ledgerGap,
        message: `Reversed ${reversalIds.length} adjustment(s) totalling $${totalReversed.toFixed(2)}. Ledger integrity gap: $${ledgerGap.toFixed(2)}.`,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      conn.release();
    }
  }
);

// GET /api/admin/integrity-check
router.get('/integrity-check',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { runIntegrityChecks } = require('../services/integrityCheck');
      const report = await runIntegrityChecks();
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/admin/run-migrations
// Body: { "confirm": "RUN_MIGRATIONS" }                           → pending-migrations.sql
// Body: { "confirm": "RUN_MIGRATIONS", "script": "full-data-reset" } → full-data-reset.sql
router.post('/run-migrations',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { confirm, script } = req.body;
    if (confirm !== 'RUN_MIGRATIONS') {
      return res.status(400).json({ error: 'Body must include { "confirm": "RUN_MIGRATIONS" }' });
    }

    const ALLOWED_SCRIPTS = {
      'pending-migrations': 'pending-migrations.sql',
      'full-data-reset':    'full-data-reset.sql',
    };
    const scriptKey  = script || 'pending-migrations';
    const scriptFile = ALLOWED_SCRIPTS[scriptKey];
    if (!scriptFile) {
      return res.status(400).json({
        error: `Unknown script "${scriptKey}". Allowed values: ${Object.keys(ALLOWED_SCRIPTS).join(', ')}`,
      });
    }

    const fs   = require('fs');
    const path = require('path');
    const SQL_FILE = path.join(__dirname, '../scripts', scriptFile);

    if (!fs.existsSync(SQL_FILE)) {
      return res.status(404).json({ error: `${scriptFile} not found` });
    }

    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !/^(--.*)$/.test(s));

    const runStmt = async (stmt) => {
      if (/^\s*SELECT\b/i.test(stmt)) {
        const [rows] = await db.execute(stmt);
        return { type: 'SELECT', rows: rows.length };
      }
      await db.execute(stmt);
      return { type: 'DDL/DML', preview: stmt.replace(/\s+/g, ' ').slice(0, 80) };
    };

    let ok = 0;
    let failed = 0;
    const results = [];
    for (const stmt of statements) {
      try {
        const r = await runStmt(stmt);
        results.push({ status: 'ok', ...r });
        ok++;
      } catch (err) {
        results.push({ status: 'error', preview: stmt.slice(0, 80), error: err.message });
        failed++;
      }
    }

    res.json({
      script: scriptFile,
      applied: ok,
      failed,
      results,
      ran_at: new Date().toISOString(),
    });
  }
);

// GET /api/admin/usdc-report?year=2026&month=6
router.get('/usdc-report',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { generateUsdcMonthlyReport } = require('../services/usdcReporting');
      const year  = req.query.year  ? parseInt(req.query.year)  : undefined;
      const month = req.query.month ? parseInt(req.query.month) : undefined;
      const report = await generateUsdcMonthlyReport(year, month);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/admin/debug-holdings — TEMPORARY diagnostic endpoint
// Returns token_holdings rows with balance <= 0 so we can identify bad records.
// Remove this endpoint after the investigation is complete.
router.get('/debug-holdings',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      // token_holdings.token_id is INTEGER; tokens.id is SERIAL (INTEGER) — no cast needed
      // column is 'balance' not 'quantity'
      const [rows] = await db.execute(`
        SELECT
          th.id,
          th.user_id,
          th.token_id,
          th.balance,
          th.reserved,
          u.email,
          t.symbol
        FROM token_holdings th
        LEFT JOIN users  u ON u.id = th.user_id
        LEFT JOIN tokens t ON t.id = th.token_id
        WHERE th.balance <= 0
        ORDER BY th.balance ASC
        LIMIT 20
      `);
      res.json({ count: rows.length, holdings: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/admin/travel-rule — Travel Rule records (SI 99 Part V)
// Query params: from (ISO date), to (ISO date), user_id, limit (default 50)
router.get('/travel-rule',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { from, to, user_id, limit = 50 } = req.query;
      const conditions = [];
      const params     = [];

      if (from) { conditions.push('tr.created_at >= ?'); params.push(from); }
      if (to)   { conditions.push('tr.created_at <= ?'); params.push(to + 'T23:59:59Z'); }
      if (user_id) { conditions.push('tr.originator_user_id = ?'); params.push(user_id); }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      params.push(Math.min(parseInt(limit) || 50, 200));

      const [rows] = await db.execute(
        `SELECT tr.*, u.email AS originator_email
         FROM travel_rule_records tr
         LEFT JOIN users u ON u.id = tr.originator_user_id
         ${where}
         ORDER BY tr.created_at DESC
         LIMIT ?`,
        params
      );
      res.json({ count: rows.length, records: rows });
    } catch (err) {
      console.error('[ADMIN] GET /travel-rule error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/admin/cdd — CDD checks queue (SI 99 Section 21)
// Query params: status (PENDING|CLEARED|FLAGGED), from, to, limit (default 50)
router.get('/cdd',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { status, from, to, limit = 50 } = req.query;
      const conditions = [];
      const params     = [];

      if (status) { conditions.push('c.cdd_status = ?'); params.push(status.toUpperCase()); }
      if (from)   { conditions.push('c.triggered_at >= ?'); params.push(from); }
      if (to)     { conditions.push('c.triggered_at <= ?'); params.push(to + 'T23:59:59Z'); }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      params.push(Math.min(parseInt(limit) || 50, 200));

      const [rows] = await db.execute(
        `SELECT c.*, u.email, u.full_name
         FROM cdd_checks c
         LEFT JOIN users u ON u.id = c.user_id
         ${where}
         ORDER BY c.triggered_at DESC
         LIMIT ?`,
        params
      );
      res.json({ count: rows.length, checks: rows });
    } catch (err) {
      console.error('[ADMIN] GET /cdd error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/admin/cdd/:id/clear — mark CDD check as CLEARED
router.put('/cdd/:id/clear',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { notes } = req.body;
      const { clearCDDCheck } = require('../services/cddService');
      await clearCDDCheck(db, req.params.id, req.user.userId, notes);
      res.json({ success: true, cdd_id: req.params.id, status: 'CLEARED' });
    } catch (err) {
      console.error('[ADMIN] PUT /cdd/clear error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/admin/cdd/:id/flag — mark CDD check as FLAGGED (triggers SAR notification)
router.put('/cdd/:id/flag',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { notes } = req.body;
      const { flagCDDCheck } = require('../services/cddService');
      await flagCDDCheck(db, req.params.id, req.user.userId, notes);

      // Fetch CDD record to notify compliance officer
      const [rows] = await db.execute(
        `SELECT c.*, u.email, u.full_name
         FROM cdd_checks c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.id = ? LIMIT 1`,
        [req.params.id]
      );
      if (rows[0]) {
        const { notifySuspiciousActivityReport } = require('../utils/mailer');
        notifySuspiciousActivityReport({
          cddId:           req.params.id,
          investorEmail:   rows[0].email,
          investorName:    rows[0].full_name,
          transactionType: rows[0].transaction_type,
          amountUsd:       rows[0].amount_usd,
          triggeredAt:     rows[0].triggered_at,
          reviewerNotes:   notes,
        }).catch(e => console.error('[MAILER] SAR notification failed (non-fatal):', e.message));
      }

      res.json({ success: true, cdd_id: req.params.id, status: 'FLAGGED' });
    } catch (err) {
      console.error('[ADMIN] PUT /cdd/flag error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/admin/offerings/:id/toggle-retail — enable/disable retail IPO participation
router.put(
  '/offerings/:id/toggle-retail',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, allow_retail_ipo FROM primary_offerings WHERE id = ?',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Offering not found' });
      const newValue = req.body.allow_retail_ipo !== undefined
        ? !!req.body.allow_retail_ipo
        : !rows[0].allow_retail_ipo;
      await db.execute(
        'UPDATE primary_offerings SET allow_retail_ipo = ? WHERE id = ?',
        [newValue, req.params.id]
      );
      res.json({ success: true, offering_id: req.params.id, allow_retail_ipo: newValue });
    } catch (err) {
      console.error('[ADMIN] PUT /offerings/toggle-retail error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/admin/offerings/:id/open-public — end anchor phase immediately (anchor_phase_end_date = NOW())
router.put(
  '/offerings/:id/open-public',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, status FROM primary_offerings WHERE id = ?',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Offering not found' });
      if (rows[0].status !== 'OPEN') {
        return res.status(400).json({ error: 'Offering must be OPEN to open the public phase.' });
      }
      await db.execute(
        'UPDATE primary_offerings SET anchor_phase_end_date = NOW(), public_phase_start_date = NOW() WHERE id = ?',
        [req.params.id]
      );

      // Notify all KYC-approved retail investors non-blocking
      const [offerData] = await db.execute(
        `SELECT po.*, t.token_symbol, t.token_name
         FROM primary_offerings po
         LEFT JOIN tokens t ON t.id = po.token_id
         WHERE po.id = ?`,
        [req.params.id]
      );
      if (offerData[0]) {
        const offering = offerData[0];
        db.execute(`
          SELECT u.email, u.full_name AS name
          FROM users u
          JOIN kyc_records kr ON kr.user_id = u.id
          WHERE kr.status = 'APPROVED' AND u.role = 'INVESTOR'
        `).then(([investors]) => {
          const { notifyOfferingPublicPhaseOpen } = require('../utils/mailer');
          notifyOfferingPublicPhaseOpen({
            investors:    investors,
            tokenName:    offering.token_name,
            tokenSymbol:  offering.token_symbol,
            assetType:    offering.asset_type,
            priceUsd:     offering.offering_price_usd,
            retailMinUsd: offering.retail_min_usd || offering.min_subscription_usd,
            closeDate:    offering.subscription_deadline,
            offeringId:   req.params.id,
          }).catch(e => console.error('[MAILER] notifyOfferingPublicPhaseOpen failed:', e.message));
        }).catch(e => console.error('[ADMIN] open-public investor query failed (non-fatal):', e.message));
      }

      res.json({ success: true, offering_id: req.params.id, public_phase_opened_at: new Date().toISOString() });
    } catch (err) {
      console.error('[ADMIN] PUT /offerings/open-public error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;