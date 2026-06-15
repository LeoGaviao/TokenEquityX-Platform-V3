const db = require('../db/pool');

async function check(id, label, fn) {
  try {
    return { id, label, ...(await fn()) };
  } catch (e) {
    return { id, label, status: 'ERROR', count: 0, error: e.message };
  }
}

async function runIntegrityChecks() {
  const startedAt = new Date().toISOString();

  const checks = await Promise.all([

    check('negative_balances', 'Negative wallet balances', async () => {
      const [rows] = await db.execute(
        `SELECT user_id, CAST(balance_usd AS TEXT) AS balance FROM investor_wallets WHERE balance_usd < 0`
      );
      return { status: rows.length === 0 ? 'OK' : 'FAIL', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} wallet(s) have a negative balance` : null };
    }),

    check('orphaned_deposits', 'Orphaned confirmed deposits', async () => {
      const [rows] = await db.execute(
        `SELECT id FROM deposit_requests WHERE status = 'CONFIRMED' AND user_id NOT IN (SELECT id FROM users)`
      );
      return { status: rows.length === 0 ? 'OK' : 'WARN', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} CONFIRMED deposit(s) belong to deleted accounts` : null };
    }),

    check('kyc_no_wallet', 'KYC-approved investors without wallet', async () => {
      const [rows] = await db.execute(
        `SELECT u.id FROM users u LEFT JOIN investor_wallets w ON w.user_id = u.id
         WHERE u.kyc_status = 'APPROVED' AND u.role = 'INVESTOR' AND w.user_id IS NULL`
      );
      return { status: rows.length === 0 ? 'OK' : 'WARN', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} KYC-approved investor(s) have no wallet record` : null };
    }),

    check('overdue_settlements', 'Overdue pending settlements (>5 days)', async () => {
      const [rows] = await db.execute(
        `SELECT id FROM settlement_instructions WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '5 days'`
      );
      return { status: rows.length === 0 ? 'OK' : 'WARN', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} settlement(s) have been PENDING for more than 5 days` : null };
    }),

    check('stale_withdrawals', 'Stale withdrawal requests (>7 days PENDING)', async () => {
      const [rows] = await db.execute(
        `SELECT id FROM withdrawal_requests WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '7 days'`
      );
      return { status: rows.length === 0 ? 'OK' : 'WARN', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} withdrawal request(s) have been PENDING for more than 7 days` : null };
    }),

    check('zero_holdings', 'Token holdings with zero or negative balance', async () => {
      const [rows] = await db.execute(
        `SELECT user_id, token_id FROM token_holdings WHERE balance <= 0`
      );
      return { status: rows.length === 0 ? 'OK' : 'WARN', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} holding record(s) have zero or negative balance` : null };
    }),

    check('stale_kyc', 'KYC records pending >14 days', async () => {
      const [rows] = await db.execute(
        `SELECT id FROM kyc_records WHERE status = 'PENDING' AND submitted_at < NOW() - INTERVAL '14 days'`
      );
      return { status: rows.length === 0 ? 'OK' : 'WARN', count: rows.length,
        detail: rows.length > 0 ? `${rows.length} KYC record(s) have been awaiting review for more than 14 days` : null };
    }),

  ]);

  const failCount  = checks.filter(c => c.status === 'FAIL').length;
  const warnCount  = checks.filter(c => c.status === 'WARN').length;
  const errorCount = checks.filter(c => c.status === 'ERROR').length;
  const overallStatus = failCount > 0 ? 'FAIL' : (warnCount + errorCount) > 0 ? 'WARN' : 'OK';

  return {
    startedAt,
    completedAt:   new Date().toISOString(),
    overallStatus,
    summary: {
      total: checks.length,
      ok:    checks.filter(c => c.status === 'OK').length,
      warn:  warnCount,
      fail:  failCount,
      error: errorCount,
    },
    checks,
  };
}

module.exports = { runIntegrityChecks };
