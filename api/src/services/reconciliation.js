const db = require('../db/pool');
const { sendMessage } = require('../utils/messenger');

async function runReconciliation(trigger = 'SCHEDULED', performedBy = null) {
  try {
    const [settingRows] = await db.execute("SELECT value FROM platform_settings WHERE key = 'usdc_omnibus_wallet'");
    const omnibusWallet = settingRows[0]?.value || '';
    const [ledgerRows]  = await db.execute('SELECT COALESCE(SUM(balance_usdc), 0) as total FROM investor_wallets');
    const ledgerTotal   = parseFloat(ledgerRows[0]?.total || 0);
    let onChainBalance  = ledgerTotal;
    let notes = omnibusWallet
      ? `Omnibus wallet: ${omnibusWallet.slice(0,8)}...${omnibusWallet.slice(-6)} — on-chain query pending Polygon integration`
      : 'Omnibus wallet not configured — on-chain check skipped';
    const variance = onChainBalance - ledgerTotal;
    const TOLERANCE = 0.01;
    let status = 'OK';
    if (Math.abs(variance) > 100) status = 'CRITICAL';
    else if (Math.abs(variance) > TOLERANCE) status = 'WARNING';
    await db.execute(
      'INSERT INTO reconciliation_logs (trigger, on_chain_balance, ledger_total, variance, status, notes, performed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trigger, onChainBalance, ledgerTotal, variance, status, notes, performedBy]
    );
    if (status === 'CRITICAL') {
      const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
      if (adminRows.length > 0) {
        await sendMessage({
          recipientId: adminRows[0].id,
          subject: '🚨 CRITICAL: USDC Reconciliation Failure',
          body: `Critical discrepancy detected.\n\nOn-chain: $${onChainBalance.toFixed(2)}\nLedger: $${ledgerTotal.toFixed(2)}\nVariance: $${variance.toFixed(2)}\n\nInvestigate immediately.`,
          type: 'SYSTEM', category: 'WALLET',
        }).catch(() => {});
      }
    }
    return { status, onChainBalance, ledgerTotal, variance, trigger };
  } catch (err) {
    console.error('[RECONCILIATION] Failed:', err.message);
    throw err;
  }
}

module.exports = { runReconciliation };
