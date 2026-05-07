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
    await db.execute(
      'UPDATE disbursement_queue SET status=$1, bank_reference=$2, notes=$3, disbursed_at=NOW(), disbursed_by=$4 WHERE id=$5',
      ['DISBURSED', bank_reference, notes||null, req.user.userId, req.params.id]
    );
    res.json({ success: true, message: 'Disbursement recorded.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
