/**
 * One-time backfill: refund IMTT for rejected withdrawals that were processed
 * before the rejection handler was fixed to return the tax.
 *
 * Safe to run multiple times — skips any withdrawal that already has a REFUND
 * transaction with the same reference_id.
 *
 * Usage:
 *   node api/src/scripts/backfill-imtt-refunds.js          # dry-run (shows what would change)
 *   node api/src/scripts/backfill-imtt-refunds.js --apply  # apply the changes
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const db = require('../db/pool');

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n[IMTT Backfill] Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to commit changes)' : 'APPLYING CHANGES'}\n`);

  // Find every rejected withdrawal that:
  //   (a) had IMTT charged — wallet_transactions row with description starting 'IMTT'
  //   (b) never had it refunded — no REFUND row for same reference_id
  const [candidates] = await db.execute(`
    SELECT
      wr.id             AS withdrawal_id,
      wr.user_id,
      wr.amount_usd,
      wr.created_at,
      ABS(wt.amount_usd) AS imtt_amount,
      u.email,
      u.full_name
    FROM withdrawal_requests wr
    JOIN wallet_transactions wt
      ON wt.reference_id = wr.id
     AND wt.description LIKE 'IMTT%'
    LEFT JOIN wallet_transactions refund
      ON refund.reference_id = wr.id
     AND refund.type = 'REFUND'
    LEFT JOIN users u ON u.id = wr.user_id
    WHERE wr.status = 'REJECTED'
      AND refund.id IS NULL
    ORDER BY wr.created_at ASC
  `);

  if (candidates.length === 0) {
    console.log('No unrefunded IMTT found. Nothing to do.');
    await db.end();
    return;
  }

  console.log(`Found ${candidates.length} rejected withdrawal(s) with unrefunded IMTT:\n`);
  let totalImtt = 0;
  for (const c of candidates) {
    console.log(
      `  ${c.withdrawal_id} | ${c.email || '(deleted user)'} | ` +
      `withdrawal $${parseFloat(c.amount_usd).toFixed(2)} | IMTT $${parseFloat(c.imtt_amount).toFixed(2)} | ` +
      `rejected ${new Date(c.created_at).toISOString().slice(0, 10)}`
    );
    totalImtt += parseFloat(c.imtt_amount);
  }
  console.log(`\nTotal IMTT to refund: $${totalImtt.toFixed(2)}\n`);

  if (DRY_RUN) {
    console.log('Dry run complete. Re-run with --apply to apply these changes.');
    await db.end();
    return;
  }

  let applied = 0;
  let skipped = 0;

  for (const c of candidates) {
    // Skip if investor account was deleted (can't credit a non-existent wallet)
    if (!c.user_id) {
      console.warn(`  SKIP ${c.withdrawal_id} — user_id is null (account deleted)`);
      skipped++;
      continue;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check wallet still exists
      const [wallets] = await conn.execute(
        'SELECT balance_usd FROM investor_wallets WHERE user_id = ?',
        [c.user_id]
      );
      if (wallets.length === 0) {
        await conn.rollback();
        console.warn(`  SKIP ${c.withdrawal_id} — no investor_wallets row for user ${c.user_id}`);
        skipped++;
        continue;
      }

      const balanceBefore = parseFloat(wallets[0].balance_usd);
      const imttAmount    = parseFloat(c.imtt_amount);
      const balanceAfter  = parseFloat((balanceBefore + imttAmount).toFixed(2));

      // Credit IMTT back to investor
      await conn.execute(
        'UPDATE investor_wallets SET balance_usd = balance_usd + ?, updated_at = NOW() WHERE user_id = ?',
        [imttAmount, c.user_id]
      );

      // Ledger entry
      await conn.execute(
        `INSERT INTO wallet_transactions
           (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
         VALUES (gen_random_uuid(), ?, 'REFUND', ?, ?, ?, ?, ?)`,
        [
          c.user_id,
          imttAmount,
          balanceBefore,
          balanceAfter,
          c.withdrawal_id,
          `IMTT refund — withdrawal rejected (backfill 2026-05-28)`,
        ]
      );

      // Reverse platform treasury liability
      await conn.execute(
        'UPDATE platform_treasury SET usd_liability = GREATEST(0, usd_liability - ?), updated_at = NOW() WHERE id = 1',
        [imttAmount]
      );

      await conn.commit();

      console.log(
        `  OK  ${c.withdrawal_id} | ${c.email} | ` +
        `+$${imttAmount.toFixed(2)} IMTT refunded (balance $${balanceBefore.toFixed(2)} → $${balanceAfter.toFixed(2)})`
      );
      applied++;
    } catch (err) {
      await conn.rollback();
      console.error(`  ERR ${c.withdrawal_id} — ${err.message}`);
      skipped++;
    } finally {
      conn.release();
    }
  }

  console.log(`\nDone. Applied: ${applied} | Skipped: ${skipped} | Total IMTT refunded: $${totalImtt.toFixed(2)}`);
  await db.end();
}

main().catch(err => {
  console.error('[IMTT Backfill] Fatal:', err.message);
  process.exit(1);
});
