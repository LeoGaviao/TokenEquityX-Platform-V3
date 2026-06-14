const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { getNumericSetting } = require('../utils/platformSettings');

const ALLOWED = ['ADMIN', 'BANKING_PARTNER'];
const auth    = [authenticate, requireRole(...ALLOWED)];

// GET /api/banking-partner/dashboard — KPI overview
router.get('/dashboard', ...auth, async (req, res) => {
  try {
    const [[pending]]   = await db.execute("SELECT COUNT(*) as c, COALESCE(SUM(net_amount_usd),0) as v FROM settlement_instructions WHERE status='PENDING'");
    const [[today]]     = await db.execute("SELECT COUNT(*) as c, COALESCE(SUM(net_amount_usd),0) as v FROM settlement_instructions WHERE status='COMPLETED' AND processed_at::date = CURRENT_DATE");
    const [[wht]]       = await db.execute("SELECT COALESCE(SUM(total_amount_usd),0) as v FROM wht_batches WHERE status='PENDING'");
    const [[disburse]]  = await db.execute("SELECT COUNT(*) as c, COALESCE(SUM(net_amount),0) as v FROM disbursement_queue WHERE status='PENDING'");
    const [[recon]]     = await db.execute("SELECT * FROM reconciliation_logs ORDER BY reconciled_at DESC LIMIT 1");
    res.json({
      pending_settlements:   { count: parseInt(pending.c), value: parseFloat(pending.v) },
      completed_today:       { count: parseInt(today.c),   value: parseFloat(today.v) },
      wht_pending:           { value: parseFloat(wht.v) },
      disbursements_pending: { count: parseInt(disburse.c), value: parseFloat(disburse.v) },
      last_reconciliation:   recon || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/banking-partner/settlements — pending and recent settlements
router.get('/settlements', ...auth, async (req, res) => {
  try {
    const status  = req.query.status || 'PENDING';
    const limit   = Math.min(100, parseInt(req.query.limit) || 50);
    const [rows]  = await db.execute(
      `SELECT s.*, u.email as investor_email, u.full_name as investor_name
       FROM settlement_instructions s
       LEFT JOIN users u ON u.id = s.investor_id
       WHERE s.status = $1
       ORDER BY s.created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/settlements/:id/confirm — confirm settlement processed
router.put('/settlements/:id/confirm', ...auth, async (req, res) => {
  const { bank_reference, notes } = req.body;
  if (!bank_reference) return res.status(400).json({ error: 'Bank reference number is required' });
  try {
    await db.execute(
      `UPDATE settlement_instructions SET
        status='COMPLETED', bank_reference=$1, notes=$2,
        processed_at=NOW(), processed_by=$3, updated_at=NOW()
       WHERE id=$4 AND status='PENDING'`,
      [bank_reference, notes||null, req.user.userId, req.params.id]
    );
    res.json({ success: true, message: 'Settlement confirmed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/settlements/:id/reject — reject/flag settlement
router.put('/settlements/:id/reject', ...auth, async (req, res) => {
  const { notes } = req.body;
  try {
    await db.execute(
      `UPDATE settlement_instructions SET status='FAILED', notes=$1, processed_at=NOW(), processed_by=$2, updated_at=NOW() WHERE id=$3`,
      [notes||'Rejected by banking partner', req.user.userId, req.params.id]
    );
    res.json({ success: true, message: 'Settlement flagged as failed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/banking-partner/wht — WHT batches
router.get('/wht', ...auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM wht_batches ORDER BY created_at DESC LIMIT 50');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/wht/:id/remit — mark WHT batch as remitted to ZIMRA
router.put('/wht/:id/remit', ...auth, async (req, res) => {
  const { zimra_reference } = req.body;
  if (!zimra_reference) return res.status(400).json({ error: 'ZIMRA reference required' });
  try {
    await db.execute(
      'UPDATE wht_batches SET status=$1, zimra_reference=$2, remitted_at=NOW(), remitted_by=$3 WHERE id=$4',
      ['REMITTED', zimra_reference, req.user.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/banking-partner/disbursements — issuer disbursement queue
router.get('/disbursements', ...auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM disbursement_queue WHERE status IN ('PENDING','PROCESSING') ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/disbursements/:id/process — process disbursement to issuer
router.put('/disbursements/:id/process', ...auth, async (req, res) => {
  const { bank_reference, notes } = req.body;
  if (!bank_reference) return res.status(400).json({ error: 'Bank reference required' });
  try {
    const [dqRows] = await db.execute(
      'SELECT * FROM disbursement_queue WHERE id = $1',
      [req.params.id]
    );
    if (dqRows.length === 0) return res.status(404).json({ error: 'Disbursement record not found' });
    const dq = dqRows[0];

    await db.execute(
      'UPDATE disbursement_queue SET status=$1, bank_reference=$2, notes=$3, disbursed_at=NOW(), disbursed_by=$4 WHERE id=$5',
      ['DISBURSED', bank_reference, notes||null, req.user.userId, req.params.id]
    );

    // FIX 2.3 — notify issuer that proceeds have been disbursed
    try {
      const { sendMessage }               = require('../utils/messenger');
      const { notifyIssuerProceedsDisbursed } = require('../utils/mailer');

      if (dq.issuer_id) {
        await sendMessage({
          recipientId: dq.issuer_id,
          subject:     `💰 Proceeds Disbursed — ${dq.token_symbol || 'Offering'}`,
          body:        `Your primary offering proceeds for ${dq.entity_name || dq.token_symbol || 'your offering'} have been disbursed.\n\nGross Amount: $${parseFloat(dq.gross_amount).toFixed(2)}\nNet Disbursed: $${parseFloat(dq.net_amount).toFixed(2)}\nBank Reference: ${bank_reference}\n\nPlease allow 1-2 business days for the transfer to reflect in your account.`,
          type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
        }).catch(e => console.error('[MESSENGER] disbursements/process sendMessage (issuer) failed:', e.message));

        const [disbIssuerRows] = await db.execute(
          'SELECT email, full_name FROM users WHERE id = $1', [dq.issuer_id]
        );
        if (disbIssuerRows[0]?.email) {
          const feesDeducted = parseFloat(
            (parseFloat(dq.platform_fee || 0) + parseFloat(dq.secz_levy || 0) + parseFloat(dq.vat_on_fees || 0)).toFixed(2)
          );
          notifyIssuerProceedsDisbursed({
            issuerEmail:   disbIssuerRows[0].email,
            issuerName:    disbIssuerRows[0].full_name,
            tokenSymbol:   dq.token_symbol,
            entityName:    dq.entity_name,
            grossAmount:   dq.gross_amount,
            feesDeducted,
            netAmount:     dq.net_amount,
            bankReference: bank_reference,
          }).catch(e => console.error('[MAILER] disbursements/process notifyIssuerProceedsDisbursed failed:', e.message));
        }
      }
    } catch (notifyErr) {
      console.error('[DISBURSEMENT] Notification error (non-fatal):', notifyErr.message);
    }

    res.json({ success: true, message: 'Disbursement recorded.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DEPOSIT MANAGEMENT ───────────────────────────────────────────────────────

// GET /api/banking-partner/deposits — list deposit requests pending bank confirmation
router.get('/deposits', ...auth, async (req, res) => {
  try {
    const status = req.query.status || 'PENDING_CONFIRMATION';
    const [rows] = await db.execute(
      `SELECT dr.*, u.full_name as investor_name, u.email as investor_email
       FROM deposit_requests dr
       LEFT JOIN users u ON u.id = dr.user_id
       WHERE dr.status = $1
       ORDER BY dr.created_at DESC
       LIMIT 100`,
      [status]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/deposits/:id/confirm — confirm deposit received + credit wallet
router.put('/deposits/:id/confirm', ...auth, async (req, res) => {
  const { bank_reference, notes } = req.body;
  if (!bank_reference) return res.status(400).json({ error: 'Bank reference is required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [drRows] = await conn.execute(
      "SELECT * FROM deposit_requests WHERE id = $1 AND status = 'PENDING_CONFIRMATION'",
      [req.params.id]
    );
    if (drRows.length === 0) return res.status(404).json({ error: 'Deposit not found or already processed' });
    const dep = drRows[0];

    // Mark deposit confirmed
    await conn.execute(
      `UPDATE deposit_requests SET status='CONFIRMED', bank_reference=$1, notes=$2,
       confirmed_at=NOW(), confirmed_by=$3 WHERE id=$4`,
      [bank_reference, notes||null, req.user.userId, dep.id]
    );

    // Credit investor wallet
    const [[wallet]] = await conn.execute(
      'SELECT id, balance_usd FROM investor_wallets WHERE user_id = $1 FOR UPDATE',
      [dep.user_id]
    );
    if (!wallet) {
      await conn.execute(
        'INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd) VALUES (gen_random_uuid(),$1,$2,0,0)',
        [dep.user_id, dep.amount_usd]
      );
      await conn.execute(
        `INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
         VALUES (gen_random_uuid(),$1,'DEPOSIT',$2,0,$2,$3,$4)`,
        [dep.user_id, dep.amount_usd, dep.id, `Bank deposit confirmed — ref ${bank_reference}`]
      );
    } else {
      const newBal = parseFloat(wallet.balance_usd) + parseFloat(dep.amount_usd);
      await conn.execute(
        'UPDATE investor_wallets SET balance_usd=$1 WHERE user_id=$2',
        [newBal, dep.user_id]
      );
      await conn.execute(
        `INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
         VALUES (gen_random_uuid(),$1,'DEPOSIT',$2,$3,$4,$5,$6)`,
        [dep.user_id, dep.amount_usd, wallet.balance_usd, newBal, dep.id, `Bank deposit confirmed — ref ${bank_reference}`]
      );
    }

    await conn.commit();

    // Non-fatal in-platform notification
    try {
      const { sendMessage } = require('../utils/messenger');
      await sendMessage({
        recipientId: dep.user_id,
        subject: `✅ Deposit Confirmed — $${parseFloat(dep.amount_usd).toFixed(2)}`,
        body: `Your bank deposit of $${parseFloat(dep.amount_usd).toFixed(2)} has been confirmed and credited to your wallet.\n\nBank reference: ${bank_reference}`,
        type: 'SYSTEM', category: 'WALLET', referenceId: dep.id,
      });
    } catch {}

    res.json({ success: true, message: `Deposit confirmed and $${parseFloat(dep.amount_usd).toFixed(2)} credited.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// PUT /api/banking-partner/deposits/:id/reject — reject unmatched deposit
router.put('/deposits/:id/reject', ...auth, async (req, res) => {
  const { notes } = req.body;
  try {
    await db.execute(
      "UPDATE deposit_requests SET status='REJECTED', notes=$1, confirmed_at=NOW(), confirmed_by=$2 WHERE id=$3",
      [notes||'Rejected by banking partner', req.user.userId, req.params.id]
    );
    res.json({ success: true, message: 'Deposit rejected.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── WITHDRAWAL MANAGEMENT ─────────────────────────────────────────────────────

// GET /api/banking-partner/withdrawals — list withdrawal requests being processed
router.get('/withdrawals', ...auth, async (req, res) => {
  try {
    const status = req.query.status || 'PROCESSING';
    const [rows] = await db.execute(
      `SELECT wr.*, u.full_name as investor_name, u.email as investor_email
       FROM withdrawal_requests wr
       LEFT JOIN users u ON u.id = wr.user_id
       WHERE wr.status = $1
       ORDER BY wr.created_at DESC
       LIMIT 100`,
      [status]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/withdrawals/:id/complete — mark withdrawal paid out
router.put('/withdrawals/:id/complete', ...auth, async (req, res) => {
  const { bank_reference, notes } = req.body;
  if (!bank_reference) return res.status(400).json({ error: 'Bank reference is required' });
  try {
    await db.execute(
      `UPDATE withdrawal_requests SET status='COMPLETED', bank_reference=$1, notes=$2,
       processed_at=NOW(), processed_by=$3 WHERE id=$4 AND status='PROCESSING'`,
      [bank_reference, notes||null, req.user.userId, req.params.id]
    );

    // Non-fatal notification
    const [wrRows] = await db.execute('SELECT * FROM withdrawal_requests WHERE id=$1', [req.params.id]);
    if (wrRows[0]) {
      const wr = wrRows[0];
      try {
        const { sendMessage } = require('../utils/messenger');
        await sendMessage({
          recipientId: wr.user_id,
          subject: `✅ Withdrawal Completed — $${parseFloat(wr.amount_usd).toFixed(2)}`,
          body: `Your withdrawal of $${parseFloat(wr.amount_usd).toFixed(2)} has been processed and sent to your bank account.\n\nBank reference: ${bank_reference}`,
          type: 'SYSTEM', category: 'WALLET', referenceId: wr.id,
        });
      } catch {}
    }

    res.json({ success: true, message: 'Withdrawal marked as completed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/banking-partner/withdrawals/:id/reject — reject withdrawal + refund wallet
router.put('/withdrawals/:id/reject', ...auth, async (req, res) => {
  const { notes } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [wrRows] = await conn.execute(
      "SELECT * FROM withdrawal_requests WHERE id=$1 AND status='PROCESSING'",
      [req.params.id]
    );
    if (wrRows.length === 0) return res.status(404).json({ error: 'Withdrawal not found or not in PROCESSING status' });
    const wr = wrRows[0];

    await conn.execute(
      "UPDATE withdrawal_requests SET status='REJECTED', notes=$1, processed_at=NOW(), processed_by=$2 WHERE id=$3",
      [notes||'Rejected by banking partner', req.user.userId, wr.id]
    );

    // Refund the held amount back to wallet
    const [[wallet]] = await conn.execute(
      'SELECT balance_usd, reserved_usd FROM investor_wallets WHERE user_id=$1 FOR UPDATE',
      [wr.user_id]
    );
    if (wallet) {
      const newBal      = parseFloat(wallet.balance_usd)   + parseFloat(wr.amount_usd);
      const newReserved = Math.max(0, parseFloat(wallet.reserved_usd) - parseFloat(wr.amount_usd));
      await conn.execute(
        'UPDATE investor_wallets SET balance_usd=$1, reserved_usd=$2 WHERE user_id=$3',
        [newBal, newReserved, wr.user_id]
      );
      await conn.execute(
        `INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
         VALUES (gen_random_uuid(),$1,'REFUND',$2,$3,$4,$5,$6)`,
        [wr.user_id, wr.amount_usd, wallet.balance_usd, newBal, wr.id, `Withdrawal rejected — refunded to wallet`]
      );
    }

    await conn.commit();

    try {
      const { sendMessage } = require('../utils/messenger');
      await sendMessage({
        recipientId: wr.user_id,
        subject: `⚠️ Withdrawal Rejected — $${parseFloat(wr.amount_usd).toFixed(2)} Refunded`,
        body: `Your withdrawal request of $${parseFloat(wr.amount_usd).toFixed(2)} could not be processed and has been refunded to your wallet.\n\nReason: ${notes||'Rejected by banking partner'}`,
        type: 'SYSTEM', category: 'WALLET', referenceId: wr.id,
      });
    } catch {}

    res.json({ success: true, message: `Withdrawal rejected and $${parseFloat(wr.amount_usd).toFixed(2)} refunded to investor wallet.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// GET /api/banking-partner/batch-file — download daily settlement CSV
router.get('/batch-file', ...auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [rows] = await db.execute(
      `SELECT s.id, s.type, s.reference, s.token_symbol,
              u.full_name as investor_name, u.email as investor_email,
              s.amount_usd, s.fee_usd, s.wht_usd, s.net_amount_usd,
              s.status, s.bank_reference, s.created_at, s.processed_at
       FROM settlement_instructions s
       LEFT JOIN users u ON u.id = s.investor_id
       WHERE s.created_at::date = $1
       ORDER BY s.created_at ASC`,
      [date]
    );
    const header = 'ID,Type,Reference,Token,Investor,Email,Gross Amount,Fee,WHT,Net Amount,Status,Bank Reference,Created,Processed\n';
    const csv = rows.map(r =>
      `${r.id},${r.type},${r.reference},${r.token_symbol||''},${r.investor_name||''},${r.investor_email||''},${r.amount_usd},${r.fee_usd},${r.wht_usd},${r.net_amount_usd},${r.status},${r.bank_reference||''},${r.created_at},${r.processed_at||''}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tokenequityx-settlements-${date}.csv"`);
    res.send(header + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/banking-partner/reconciliation — reconciliation logs
router.get('/reconciliation', ...auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM reconciliation_logs ORDER BY reconciled_at DESC LIMIT 30');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/banking-partner/test-webhook — send a test webhook to verify connectivity
router.post('/test-webhook', ...auth, async (req, res) => {
  try {
    const { pushWebhook } = require('../services/webhook');
    const result = await pushWebhook('system.test', {
      message: 'TokenEquityX webhook connectivity test',
      timestamp: new Date().toISOString(),
      sent_by: req.user.userId,
    });
    if (result.skipped) {
      return res.json({ success: false, message: 'No webhook URL configured. Set it in Admin → Settings.' });
    }
    if (result.error) {
      return res.status(502).json({ success: false, message: `Webhook delivery failed: ${result.error}` });
    }
    res.json({ success: true, message: 'Test webhook delivered successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
