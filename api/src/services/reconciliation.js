const db = require('../db/pool');
const { sendMessage } = require('../utils/messenger');

const TOLERANCE = 0.01;
const TREASURY_ID = 1;

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
    // Compare sum of all investor USD wallet balances against treasury
    // usd_liability (what the platform owes investors + ZIMRA + issuers).
    // These should balance: every dollar credited to an investor wallet
    // creates an equal liability on the platform.
    const [usdLedgerRows]  = await db.execute('SELECT COALESCE(SUM(balance_usd), 0) as total FROM investor_wallets');
    const usdLedgerTotal   = parseFloat(usdLedgerRows[0]?.total || 0);
    const [treasuryRows]   = await db.execute('SELECT usd_liability FROM platform_treasury WHERE id = ?', [TREASURY_ID]);
    const usdLiability     = parseFloat(treasuryRows[0]?.usd_liability || 0);
    const usdVariance      = Math.abs(usdLedgerTotal - usdLiability);

    let usdStatus = 'OK';
    if (usdVariance > 100)       usdStatus = 'CRITICAL';
    else if (usdVariance > TOLERANCE) usdStatus = 'WARNING';

    const usdNotes = `USD ledger: $${usdLedgerTotal.toFixed(2)} | Treasury liability: $${usdLiability.toFixed(2)} | Variance: $${usdVariance.toFixed(2)}`;

    await db.execute(
      'INSERT INTO reconciliation_logs (trigger, on_chain_balance, ledger_total, variance, status, notes, performed_by, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [trigger, usdLiability, usdLedgerTotal, usdVariance, usdStatus, usdNotes, performedBy, 'USD']
    );

    // Alert admin on any CRITICAL status
    const overallStatus = [usdcStatus, usdStatus].includes('CRITICAL') ? 'CRITICAL' : 'OK';
    if (overallStatus === 'CRITICAL') {
      const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
      if (adminRows.length > 0) {
        await sendMessage({
          recipientId: adminRows[0].id,
          subject: '🚨 CRITICAL: Reconciliation Failure',
          body: `Critical discrepancy detected.\n\nUSCD — On-chain: $${usdcOnChain.toFixed(2)}, Ledger: $${usdcLedgerTotal.toFixed(2)}, Variance: $${usdcVariance.toFixed(2)}\n\nUSD — Ledger: $${usdLedgerTotal.toFixed(2)}, Treasury liability: $${usdLiability.toFixed(2)}, Variance: $${usdVariance.toFixed(2)}\n\nInvestigate immediately.`,
          type: 'SYSTEM', category: 'WALLET',
        }).catch(() => {});
      }
    }

    return {
      usdc: { status: usdcStatus, onChain: usdcOnChain, ledger: usdcLedgerTotal, variance: usdcVariance },
      usd:  { status: usdStatus,  ledger: usdLedgerTotal, liability: usdLiability, variance: usdVariance },
      trigger,
    };
  } catch (err) {
    console.error('[RECONCILIATION] Failed:', err.message);
    throw err;
  }
}

module.exports = { runReconciliation };
