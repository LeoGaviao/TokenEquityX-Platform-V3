// api/src/routes/partner.js
const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/partner/overview
router.get('/overview', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const pid = req.user.userId;

    const [[commissions]] = await db.execute(
      `SELECT COALESCE(SUM(amount_usd),0) as total, COUNT(*) as count
       FROM partner_commissions WHERE partner_id = ?`, [pid]
    );

    const [[clients]] = await db.execute(
      `SELECT COUNT(*) as count FROM partner_clients WHERE partner_id = ?`, [pid]
    );

    const [[pipeline]] = await db.execute(
      `SELECT COUNT(*) as count
       FROM partner_leads WHERE partner_id = ? AND status NOT IN ('CONVERTED','LOST')`, [pid]
    );

    res.json({
      commission_mtd:    0,
      commission_total:  parseFloat(commissions.total),
      active_clients:    parseInt(clients.count),
      pipeline_count:    parseInt(pipeline.count),
      pipeline_value:    0,
      month:             new Date().toISOString().slice(0,7)
    });
  } catch (err) {
    console.error('Partner overview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch overview: ' + err.message });
  }
});

// GET /api/partner/pipeline
router.get('/pipeline', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const pid = req.user.userId;
    const [leads] = await db.execute(
      `SELECT * FROM partner_leads WHERE partner_id = ? ORDER BY created_at DESC`,
      [pid]
    );
    res.json(leads);
  } catch (err) {
    console.error('Partner pipeline error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pipeline: ' + err.message });
  }
});

// POST /api/partner/leads
router.post('/leads', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const { lead_name, lead_email, lead_type, notes } = req.body;
    if (!lead_name || !lead_type)
      return res.status(400).json({ error: 'Lead name and lead type are required' });

    const [result] = await db.execute(
      `INSERT INTO partner_leads (partner_id, lead_name, lead_email, lead_type, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.userId, lead_name, lead_email || null, lead_type, notes || null]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add lead: ' + err.message });
  }
});

// PUT /api/partner/leads/:id
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
    res.status(500).json({ error: 'Failed to update lead: ' + err.message });
  }
});

// GET /api/partner/clients
router.get('/clients', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const [clients] = await db.execute(
      `SELECT * FROM partner_clients WHERE partner_id = ? ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json(clients);
  } catch (err) {
    console.error('Partner clients error:', err.message);
    res.status(500).json({ error: 'Failed to fetch clients: ' + err.message });
  }
});

// GET /api/partner/commissions
router.get('/commissions', authenticate, requireRole('PARTNER'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM partner_commissions WHERE partner_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.userId]
    );
    res.json({ transactions: rows, by_month: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commissions: ' + err.message });
  }
});

// GET /api/partner/referral-link
router.get('/referral-link', authenticate, requireRole('PARTNER'), async (req, res) => {
  const base = process.env.PLATFORM_URL || 'https://tokenequityx.co.zw';
  const code = Buffer.from(req.user.userId).toString('base64').slice(0,12);
  res.json({
    investor_link: `${base}/signup?ref=${code}&type=investor`,
    issuer_link:   `${base}/signup?ref=${code}&type=issuer`,
    referral_code: code
  });
});

module.exports = router;
