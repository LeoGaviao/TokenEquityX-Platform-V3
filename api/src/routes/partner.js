// api/src/routes/partner.js
// Live partner workflow: pipeline, clients, commissions, leads

const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// ── GET /api/partner/overview ────────────────────────────────────
router.get('/overview', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const pid = req.user.userId;

    // Commission MTD
    const month = new Date().toISOString().slice(0,7); // YYYY-MM
    const [[commissions]] = await db.execute(
      `SELECT COALESCE(SUM(amount_usd),0) as mtd, COUNT(*) as count
       FROM partner_commissions WHERE partner_id = ? AND month_year = ?`, [pid, month]
    );

    // Total earned all time
    const [[total]] = await db.execute(
      `SELECT COALESCE(SUM(amount_usd),0) as total FROM partner_commissions WHERE partner_id = ?`, [pid]
    );

    // Active clients
    const [[clients]] = await db.execute(
      `SELECT COUNT(*) as count FROM partner_clients WHERE partner_id = ?`, [pid]
    );

    // Pipeline value (leads not yet converted)
    const [[pipeline]] = await db.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(est_value),0) as value
       FROM partner_leads WHERE partner_id = ? AND status NOT IN ('CONVERTED','LOST')`, [pid]
    );

    res.json({
      commission_mtd:    parseFloat(commissions.mtd),
      commission_total:  parseFloat(total.total),
      active_clients:    clients.count,
      pipeline_count:    pipeline.count,
      pipeline_value:    parseFloat(pipeline.value),
      month
    });
  } catch (err) {
    console.error('Partner overview error:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// ── GET /api/partner/pipeline ────────────────────────────────────
// Returns partner's leads tracked through the submission pipeline
router.get('/pipeline', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const pid = req.user.userId;

    // Get leads + any linked submissions
    const [leads] = await db.execute(
      `SELECT l.*,
         s.id as submission_id, s.status as submission_status,
         s.entity_name, s.submission_type
       FROM partner_leads l
       LEFT JOIN data_submissions s ON s.referred_by = ? AND s.entity_name LIKE CONCAT('%', l.company_name, '%')
       WHERE l.partner_id = ?
       ORDER BY l.created_at DESC`,
      [pid, pid]
    );

    res.json(leads);
  } catch (err) {
    console.error('Partner pipeline error:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// ── POST /api/partner/leads ──────────────────────────────────────
router.post('/leads', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const { company_name, lead_type, contact_name, est_value, notes } = req.body;
    if (!company_name || !lead_type)
      return res.status(400).json({ error: 'Company name and lead type are required' });

    const [result] = await db.execute(
      `INSERT INTO partner_leads (partner_id, company_name, lead_type, contact_name, est_value, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.userId, company_name, lead_type, contact_name || null,
       est_value ? parseFloat(est_value) : null, notes || null]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add lead' });
  }
});

// ── PUT /api/partner/leads/:id ───────────────────────────────────
router.put('/leads/:id', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    await db.execute(
      `UPDATE partner_leads SET status = COALESCE(?, status), notes = COALESCE(?, notes)
       WHERE id = ? AND partner_id = ?`,
      [status || null, notes || null, req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// ── GET /api/partner/clients ─────────────────────────────────────
router.get('/clients', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const [clients] = await db.execute(
      `SELECT u.id, u.full_name, u.email, u.role, u.kyc_status, u.created_at,
         pc.created_at as referred_at
       FROM partner_clients pc
       JOIN users u ON u.id = pc.client_id
       WHERE pc.partner_id = ?
       ORDER BY pc.created_at DESC`,
      [req.user.userId]
    );
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// ── GET /api/partner/commissions ─────────────────────────────────
router.get('/commissions', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM partner_commissions WHERE partner_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.userId]
    );

    // Group by month for summary
    const by_month = rows.reduce((acc, r) => {
      if (!acc[r.month_year]) acc[r.month_year] = { month: r.month_year, total: 0, count: 0 };
      acc[r.month_year].total += parseFloat(r.amount_usd);
      acc[r.month_year].count++;
      return acc;
    }, {});

    res.json({
      transactions: rows,
      by_month:     Object.values(by_month).sort((a,b) => b.month.localeCompare(a.month))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// ── GET /api/partner/referral-link ──────────────────────────────
router.get('/referral-link', authenticate, requireRole('PARTNER'), async (req, res) => {
  const base = process.env.PLATFORM_URL || 'http://localhost:3000';
  const code = Buffer.from(req.user.userId).toString('base64').slice(0,12);
  res.json({
    investor_link: `${base}/signup?ref=${code}&type=investor`,
    issuer_link:   `${base}/signup?ref=${code}&type=issuer`,
    referral_code: code
  });
});

module.exports = router;
