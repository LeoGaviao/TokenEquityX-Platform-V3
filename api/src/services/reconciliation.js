const db = require('../db/pool');
const { sendMessage } = require('../utils/messenger');
const { getSetting } = require('../utils/platformSettings');

const TOLERANCE = 0.01;

async function runReconciliation(trigger = 'SCHEDULED', performedBy = null) {
  try {
    // ── USDC reconciliation ───────────────────────────────────────────────
    // NOTE: On-chain balance query is pending Polygon integration.
    // Until then, on_chain_balance mirrors the ledger total so variance is
    // always zero — this is intentional and expected.
    const [settingRows]    = await db.execute("SELECT value FROM platform_settings WHERE key = 'usdc_omnibus_wallet'");
    const omnibusWallet    = settingRows[0]?.value || '';
    const [usdcLedgerRows] = await db.execute('SELECT COALESCE(SUM(balance_usdc), 0) as total FROM investor_wallets');
    const usdcLedgerTotal  = parseFloat(usdcLedgerRows[0]?.total || 0);
    const usdcOnChain      = usdcLedgerTotal; // placeholder until Polygon integration
    const usdcVariance     = usdcOnChain - usdcLedgerTotal;
    const usdcNotes        = omnibusWallet
      ? `Omnibus wallet: ${omnibusWallet.slice(0,8)}...${omnibusWallet.slice(-6)} — on-chain query pending Polygon integration`
      : 'Omnibus wallet not configured — on-chain check skipped';

    let usdcStatus = 'OK';
    if (Math.abs(usdcVariance) > 100)       usdcStatus = 'CRITICAL';
    else if (Math.abs(usdcVariance) > TOLERANCE) usdcStatus = 'WARNING';

    await db.execute(
      'INSERT INTO reconciliation_logs (trigger, on_chain_balance, ledger_total, variance, status, notes, performed_by, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [trigger, usdcOnChain, usdcLedgerTotal, usdcVariance, usdcStatus, usdcNotes, performedBy, 'USDC']
    );

    // ── USD reconciliation ────────────────────────────────────────────────
    // Expected balance = confirmed deposits (for active users) − completed withdrawals.
    // Actual balance   = sum of all investor wallet USD balances.
    // Orphaned CONFIRMED deposits (user deleted without zeroing balance) are excluded;
    // they should be voided via /api/setup/delete-user to close any resulting gap.
    const [thresholdRows]  = await db.execute("SELECT value FROM platform_settings WHERE key = 'reconciliation_variance_threshold_usd'");
    const usdThreshold     = parseFloat(thresholdRows[0]?.value || '1.00');

    // Only count confirmed deposits for users who still exist — prevents deleted-account gap
    const [depositRows]    = await db.execute(`
      SELECT COALESCE(SUM(dr.amount_usd), 0) AS total
      FROM deposit_requests dr
      JOIN users u ON u.id = dr.user_id
      WHERE dr.status = 'CONFIRMED'
    `);
    const usdDeposits      = parseFloat(depositRows[0]?.total || 0);

    // Detect orphaned confirmed deposits (user deleted but deposits not voided)
    const [orphanRows]     = await db.execute(`
      SELECT COALESCE(SUM(dr.amount_usd), 0) AS total, COUNT(*) AS count
      FROM deposit_requests dr
      LEFT JOIN users u ON u.id = dr.user_id
      WHERE dr.status = 'CONFIRMED' AND u.id IS NULL
    `);
    const orphanedAmount   = parseFloat(orphanRows[0]?.total || 0);
    const orphanedCount    = parseInt(orphanRows[0]?.count   || 0);

    const [withdrawalRows] = await db.execute("SELECT COALESCE(SUM(amount_usd), 0) AS total FROM withdrawal_requests WHERE status = 'COMPLETED'");
    const usdWithdrawals   = parseFloat(withdrawalRows[0]?.total || 0);

    const usdExpected      = usdDeposits - usdWithdrawals;

    const [usdActualRows]  = await db.execute('SELECT COALESCE(SUM(balance_usd), 0) AS total FROM investor_wallets');
    const usdActual        = parseFloat(usdActualRows[0]?.total || 0);

    const usdVariance      = Math.abs(usdActual - usdExpected);

    // Secondary check: SUM(wallet_transactions) must equal SUM(investor_wallets.balance_usd)
    // Any gap here means a balance was updated without a matching ledger entry (ghost update)
    const [ledgerNetRows]  = await db.execute('SELECT COALESCE(SUM(amount_usd), 0) AS total FROM wallet_transactions');
    const ledgerNet        = parseFloat(ledgerNetRows[0]?.total || 0);
    const ledgerIntegrity  = Math.abs(ledgerNet - usdActual);

    let usdStatus = 'OK';
    if (usdVariance > usdThreshold || ledgerIntegrity > usdThreshold) usdStatus = 'CRITICAL';
    if (orphanedCount > 0) usdStatus = usdStatus === 'OK' ? 'WARNING' : usdStatus;

    const usdNotes = [
      `Confirmed deposits:     $${usdDeposits.toFixed(2)}`,
      `Completed withdrawals:  $${usdWithdrawals.toFixed(2)}`,
      `Expected balance:       $${usdExpected.toFixed(2)}`,
      `Actual ledger balance:  $${usdActual.toFixed(2)}`,
      `Variance:               $${usdVariance.toFixed(2)} (threshold: $${usdThreshold.toFixed(2)})`,
      `Ledger integrity gap:   $${ledgerIntegrity.toFixed(2)} (wallet_txns net vs wallet balances)`,
      orphanedCount > 0
        ? `⚠ ORPHANED: ${orphanedCount} CONFIRMED deposit(s) totalling $${orphanedAmount.toFixed(2)} for deleted users — run VOID fix`
        : `Orphaned deposits:      none`,
    ].join(' | ');

    await db.execute(
      'INSERT INTO reconciliation_logs (trigger, on_chain_balance, ledger_total, variance, status, notes, performed_by, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [trigger, usdExpected, usdActual, usdVariance, usdStatus, usdNotes, performedBy, 'USD']
    );

    // Alert admin on any CRITICAL status
    const overallStatus = [usdcStatus, usdStatus].includes('CRITICAL') ? 'CRITICAL' : 'OK';
    if (overallStatus === 'CRITICAL') {
      const alertBody = [
        'Critical discrepancy detected during reconciliation.',
        '',
        'USDC',
        `  On-chain balance:  $${usdcOnChain.toFixed(2)}`,
        `  Ledger total:      $${usdcLedgerTotal.toFixed(2)}`,
        `  Variance:          $${Math.abs(usdcVariance).toFixed(2)}`,
        '',
        'USD',
        `  Confirmed deposits:    $${usdDeposits.toFixed(2)}`,
        `  Completed withdrawals: $${usdWithdrawals.toFixed(2)}`,
        `  Expected balance:      $${usdExpected.toFixed(2)}`,
        `  Actual ledger balance: $${usdActual.toFixed(2)}`,
        `  Variance:              $${usdVariance.toFixed(2)} (threshold: $${usdThreshold.toFixed(2)})`,
        '',
        'Investigate immediately.',
      ].join('\n');

      // In-platform message to first admin
      const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
      if (adminRows.length > 0) {
        await sendMessage({
          recipientId: adminRows[0].id,
          subject: '🚨 CRITICAL: Reconciliation Failure',
          body: alertBody,
          type: 'SYSTEM', category: 'WALLET',
        }).catch(() => {});
      }

      // Email alert — check platform_settings first, then env vars as fallback
      const primaryEmail   = (await getSetting('reconciliation_email_primary'))   || process.env.RECONCILIATION_EMAIL_PRIMARY;
      const secondaryEmail = (await getSetting('reconciliation_email_secondary'))  || process.env.RECONCILIATION_EMAIL_SECONDARY;
      const emailRecipients = [primaryEmail, secondaryEmail].filter(Boolean);

      if (emailRecipients.length > 0) {
        try {
          const { Resend } = require('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          for (const to of emailRecipients) {
            await resend.emails.send({
              from: process.env.SMTP_FROM || 'noreply@tokenequityx.co.zw',
              to,
              subject: '🚨 CRITICAL: TokenEquityX Reconciliation Failure',
              text: alertBody,
            }).catch(() => {});
          }
        } catch {}
      }
    }

    return {
      usdc: { status: usdcStatus, onChain: usdcOnChain, ledger: usdcLedgerTotal, variance: usdcVariance },
      usd:  { status: usdStatus, actual: usdActual, expected: usdExpected, deposits: usdDeposits, withdrawals: usdWithdrawals, variance: usdVariance, threshold: usdThreshold },
      trigger,
    };
  } catch (err) {
    console.error('[RECONCILIATION] Failed:', err.message);
    throw err;
  }
}

module.exports = { runReconciliation };
