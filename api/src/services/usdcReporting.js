// api/src/services/usdcReporting.js
// Monthly USDC supervised pilot report for RBZ submission (SI 99 of 2026).
// Covers the calendar month prior to execution date.

const db = require('../db/pool');

async function generateUsdcMonthlyReport(year, month) {
  // Default to previous calendar month if not specified
  if (!year || !month) {
    const now  = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year  = prev.getFullYear();
    month = prev.getMonth() + 1; // 1-indexed
  }

  const monthStr    = String(month).padStart(2, '0');
  const periodStart = `${year}-${monthStr}-01`;
  const periodEnd   = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

  // Total USDC deposits confirmed in period
  const [depositRows] = await db.execute(
    `SELECT
       COUNT(*)                          AS deposit_count,
       COALESCE(SUM(amount_usd), 0)      AS deposit_total_usdc
     FROM deposit_requests
     WHERE currency = 'USDC'
       AND status   = 'CONFIRMED'
       AND created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'`,
    [periodStart, periodEnd]
  );

  // Total USDC withdrawals completed in period
  const [withdrawRows] = await db.execute(
    `SELECT
       COUNT(*)                          AS withdrawal_count,
       COALESCE(SUM(amount_usd), 0)      AS withdrawal_total_usdc,
       COALESCE(SUM(imtt_amount), 0)     AS imtt_total_collected
     FROM withdrawal_requests
     WHERE currency = 'USDC'
       AND status   IN ('PROCESSED', 'COMPLETED')
       AND created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'`,
    [periodStart, periodEnd]
  );

  // Unique USDC investors active in period
  const [investorRows] = await db.execute(
    `SELECT COUNT(DISTINCT user_id) AS active_investors
     FROM deposit_requests
     WHERE currency = 'USDC'
       AND created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'
     UNION ALL
     SELECT COUNT(DISTINCT user_id)
     FROM withdrawal_requests
     WHERE currency = 'USDC'
       AND created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'`,
    [periodStart, periodEnd, periodStart, periodEnd]
  );
  const activeInvestors = investorRows.reduce((s, r) => s + parseInt(r.active_investors || 0), 0);

  // Current platform USDC ledger total
  const [ledgerRows] = await db.execute(
    'SELECT COALESCE(SUM(balance_usdc), 0) AS ledger_total FROM investor_wallets'
  );
  const ledgerTotal = parseFloat(ledgerRows[0]?.ledger_total || 0);

  // Most recent reconciliation result for the period
  const [reconRows] = await db.execute(
    `SELECT on_chain_balance, ledger_total, variance, status, created_at
     FROM reconciliation_logs
     WHERE currency = 'USDC'
       AND created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'
     ORDER BY created_at DESC LIMIT 1`,
    [periodStart, periodEnd]
  );
  const latestRecon = reconRows[0] || null;

  const d = depositRows[0]  || {};
  const w = withdrawRows[0] || {};

  return {
    report_type:        'USDC_MONTHLY_RBZ',
    regulatory_basis:   'Statutory Instrument 99 of 2026 — USDC Supervised Pilot',
    period_year:        year,
    period_month:       month,
    period_start:       periodStart,
    period_end:         periodEnd,
    generated_at:       new Date().toISOString(),
    deposits: {
      count:            parseInt(d.deposit_count   || 0),
      total_usdc:       parseFloat(d.deposit_total_usdc || 0),
    },
    withdrawals: {
      count:            parseInt(w.withdrawal_count        || 0),
      total_usdc:       parseFloat(w.withdrawal_total_usdc || 0),
      imtt_collected:   parseFloat(w.imtt_total_collected  || 0),
    },
    active_investors:   activeInvestors,
    current_ledger_total_usdc: ledgerTotal,
    latest_reconciliation: latestRecon ? {
      on_chain_balance: parseFloat(latestRecon.on_chain_balance || 0),
      ledger_total:     parseFloat(latestRecon.ledger_total     || 0),
      variance:         parseFloat(latestRecon.variance         || 0),
      status:           latestRecon.status,
      checked_at:       latestRecon.created_at,
    } : null,
  };
}

module.exports = { generateUsdcMonthlyReport };
