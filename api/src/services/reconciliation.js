const db = require('../db/pool');
const { sendMessage } = require('../utils/messenger');

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
    // Expected balance = total confirmed deposits − total completed withdrawals.
    // Actual balance   = sum of all investor wallet USD balances.
    // These must agree; any gap means money entered or left the system without
    // a matching wallet credit/debit.
    const [thresholdRows]  = await db.execute("SELECT value FROM platform_settings WHERE key = 'reconciliation_variance_threshold_usd'");
    const usdThreshold     = parseFloat(thresholdRows[0]?.value || '1.00');

    const [depositRows]    = await db.execute("SELECT COALESCE(SUM(amount_usd), 0) AS total FROM deposit_requests WHERE status = 'CONFIRMED'");
    const usdDeposits      = parseFloat(depositRows[0]?.total || 0);

    const [withdrawalRows] = await db.execute("SELECT COALESCE(SUM(amount_usd), 0) AS total FROM withdrawal_requests WHERE status = 'COMPLETED'");
    const usdWithdrawals   = parseFloat(withdrawalRows[0]?.total || 0);

    const usdExpected      = usdDeposits - usdWithdrawals;

    const [usdActualRows]  = await db.execute('SELECT COALESCE(SUM(balance_usd), 0) AS total FROM investor_wallets');
    const usdActual        = parseFloat(usdActualRows[0]?.total || 0);

    const usdVariance      = Math.abs(usdActual - usdExpected);

    let usdStatus = 'OK';
    if (usdVariance > usdThreshold) usdStatus = 'CRITICAL';

    const usdNotes = [
      `Confirmed deposits:     $${usdDeposits.toFixed(2)}`,
      `Completed withdrawals:  $${usdWithdrawals.toFixed(2)}`,
      `Expected balance:       $${usdExpected.toFixed(2)}`,
      `Actual ledger balance:  $${usdActual.toFixed(2)}`,
      `Variance:               $${usdVariance.toFixed(2)} (threshold: $${usdThreshold.toFixed(2)})`,
    ].join(' | ');

    await db.execute(
      'INSERT INTO reconciliation_logs (trigger, on_chain_balance, ledger_total, variance, status, notes, performed_by, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [trigger, usdExpected, usdActual, usdVariance, usdStatus, usdNotes, performedBy, 'USD']
    );

    // Alert admin on any CRITICAL status
    const overallStatus = [usdcStatus, usdStatus].includes('CRITICAL') ? 'CRITICAL' : 'OK';
    if (overallStatus === 'CRITICAL') {
      const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
      if (adminRows.length > 0) {
        await sendMessage({
          recipientId: adminRows[0].id,
          subject: '🚨 CRITICAL: Reconciliation Failure',
          body: [
            'Critical discrepancy detected during reconciliation.',
            '',
            `USDC`,
            `  On-chain balance:  $${usdcOnChain.toFixed(2)}`,
            `  Ledger total:      $${usdcLedgerTotal.toFixed(2)}`,
            `  Variance:          $${Math.abs(usdcVariance).toFixed(2)}`,
            '',
            `USD`,
            `  Confirmed deposits:    $${usdDeposits.toFixed(2)}`,
            `  Completed withdrawals: $${usdWithdrawals.toFixed(2)}`,
            `  Expected balance:      $${usdExpected.toFixed(2)}`,
            `  Actual ledger balance: $${usdActual.toFixed(2)}`,
            `  Variance:              $${usdVariance.toFixed(2)} (threshold: $${usdThreshold.toFixed(2)})`,
            '',
            'Investigate immediately.',
          ].join('\n'),
          type: 'SYSTEM', category: 'WALLET',
        }).catch(() => {});
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
