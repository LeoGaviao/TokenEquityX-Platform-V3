// api/src/routes/bourse.js
// Handles the admin-final-approval → mock mint → bourse listing pipeline
// Also serves live market data for the investor bourse tab

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// ── GET /api/bourse/tokens ───────────────────────────────────────
// Returns all FULL_TRADING and P2P_ONLY tokens for the investor market tab
router.get('/tokens', async (req, res) => {
  try {
    const [tokens] = await db.execute(
      `SELECT t.*, u.full_name as issuer_name, u.email as issuer_email
       FROM tokens t
       LEFT JOIN users u ON t.issuer_id = u.id
       WHERE t.trading_mode IN ('FULL_TRADING', 'P2P_ONLY')
       AND t.status = 'ACTIVE'
       ORDER BY t.market_cap DESC`
    );

    // Format for frontend consumption
    const formatted = tokens.map(t => ({
      id:           t.id,
      symbol:       t.symbol,
      name:         t.name,
      asset_type:   t.asset_type,
      description:  t.description,
      price:        parseFloat(t.price_usd),
      oracle_price: t.oracle_price ? parseFloat(t.oracle_price) : null,
      market_cap:   t.market_cap ? parseFloat(t.market_cap) : parseFloat(t.price_usd) * t.total_supply,
      change_24h:   t.change_24h ? parseFloat(t.change_24h) : 0,
      volume_24h:   t.volume_24h ? parseFloat(t.volume_24h) : 0,
      total_supply: t.total_supply,
      trading_mode: t.trading_mode,
      market_state: t.market_state,
      jurisdiction: t.jurisdiction,
      listed_at:    t.listed_at,
      issuer_name:  t.issuer_name
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Bourse tokens error:', err);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// ── GET /api/bourse/tokens/:symbol ──────────────────────────────
router.get('/tokens/:symbol', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.*, u.full_name as issuer_name
       FROM tokens t
       LEFT JOIN users u ON t.issuer_id = u.id
       WHERE t.symbol = ?`,
      [req.params.symbol.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Token not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch token' });
  }
});

// ── POST /api/bourse/admin-approve ──────────────────────────────
// Admin final approval: mock-mints token and lists it on the bourse
// listing_type: 'GREENFIELD' (P2P_ONLY) | 'BROWNFIELD' (FULL_TRADING)
router.post('/admin-approve', authenticate, requireRole('ADMIN'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { submission_id, listing_type, certified_price, admin_notes } = req.body;

    if (!submission_id || !listing_type || !certified_price)
      return res.status(400).json({ error: 'submission_id, listing_type, and certified_price are required' });

    if (!['GREENFIELD', 'BROWNFIELD'].includes(listing_type))
      return res.status(400).json({ error: 'listing_type must be GREENFIELD or BROWNFIELD' });

    // Fetch the submission
    const [submissions] = await conn.execute(
      'SELECT * FROM data_submissions WHERE id = ?', [submission_id]
    );
    if (submissions.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Submission not found' });
    }
    const sub = submissions[0];

    if (sub.status !== 'AUDITOR_APPROVED') {
      await conn.rollback();
      return res.status(400).json({ error: 'Submission must be AUDITOR_APPROVED before admin final approval' });
    }

    // Determine trading mode from listing type
    // GREENFIELD = <3yr financials = P2P only
    // BROWNFIELD = 3yr+ + USD 1.5M revenue = FULL_TRADING
    const trading_mode = listing_type === 'GREENFIELD' ? 'P2P_ONLY' : 'FULL_TRADING';

    // Parse submission data to extract token details
    let submission_data = {};
    try { submission_data = JSON.parse(sub.submission_data || '{}'); } catch(e) {}

    const symbol       = submission_data.symbol || sub.entity_name?.slice(0,6).toUpperCase().replace(/\s/g,'') || `TEX${submission_id}`;
    const name         = submission_data.asset_name || sub.entity_name || `Asset ${submission_id}`;
    const total_supply = parseInt(submission_data.total_supply || submission_data.authorised_supply || 1000000);
    const asset_type   = submission_data.asset_type || 'EQUITY';
    const description  = submission_data.description || '';
    const jurisdiction = submission_data.jurisdiction || 'Zimbabwe';

    // Check if token already exists
    const [existing_token] = await conn.execute('SELECT id FROM tokens WHERE symbol = ?', [symbol]);

    let token_id;
    if (existing_token.length > 0) {
      // Update existing
      token_id = existing_token[0].id;
      await conn.execute(
        `UPDATE tokens SET
           trading_mode = ?, market_state = 'FULL_TRADING', status = 'ACTIVE',
           price_usd = ?, oracle_price = ?, total_supply = ?,
           market_cap = ?, listed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [trading_mode, certified_price, certified_price, total_supply,
         parseFloat(certified_price) * total_supply, token_id]
      );
    } else {
      // Mock mint: create token record (in production this would call blockchain)
      const [insert_result] = await conn.execute(
        `INSERT INTO tokens (symbol, name, company_name, token_symbol, token_name,
           asset_type, description, issuer_id, total_supply,
           price_usd, current_price_usd, oracle_price, market_cap,
           trading_mode, market_state, status,
           jurisdiction, submission_id, listed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FULL_TRADING', 'ACTIVE', ?, ?, NOW())
         RETURNING id`,
        [symbol, name, name, symbol, name,
         asset_type, description, sub.issuer_wallet || null, total_supply,
         certified_price, certified_price, certified_price,
         parseFloat(certified_price) * total_supply,
         trading_mode, jurisdiction, submission_id]
      );
      token_id = insert_result[0].id;
    }

    // Update submission status
    await conn.execute(
      `UPDATE data_submissions SET
         status = 'ADMIN_APPROVED', token_id = ?, listing_type = ?,
         certified_price = ?, admin_notes = ?,
         admin_approved_by = ?, admin_approved_at = NOW()
       WHERE id = ?`,
      [token_id, listing_type, certified_price, admin_notes || null, req.user.userId, submission_id]
    );

    await conn.commit();

    res.json({
      success: true,
      message: `${symbol} has been listed on the bourse as ${trading_mode}`,
      token: { id: token_id, symbol, name, trading_mode, certified_price }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Admin approve error:', err);
    res.status(500).json({ error: 'Failed to approve listing' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/bourse/tokens/:id/price ────────────────────────────
// Auditor updates oracle price for a listed token
router.put('/tokens/:id/price', authenticate, requireRole('AUDITOR', 'ADMIN'), async (req, res) => {
  try {
    const { price, source } = req.body;
    if (!price || isNaN(price)) return res.status(400).json({ error: 'Valid price required' });

    const old_price_result = await db.execute('SELECT price_usd, total_supply FROM tokens WHERE id = ?', [req.params.id]);
    if (old_price_result[0].length === 0) return res.status(404).json({ error: 'Token not found' });

    const { price_usd: old_price, total_supply } = old_price_result[0][0];
    const change = old_price > 0 ? ((price - old_price) / old_price) * 100 : 0;

    await db.execute(
      `UPDATE tokens SET oracle_price = ?, price_usd = ?, change_24h = ?,
         market_cap = ?, updated_at = NOW() WHERE id = ?`,
      [price, price, change.toFixed(4), parseFloat(price) * total_supply, req.params.id]
    );

    res.json({ success: true, new_price: price, change_24h: change });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// ── GET /api/bourse/stats ────────────────────────────────────────
// Platform-wide stats for DFI dashboard
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [[market]] = await db.execute(
      `SELECT
         COUNT(*) as total_listings,
         SUM(market_cap) as total_market_cap,
         SUM(volume_24h) as total_volume_24h,
         AVG(change_24h) as avg_change_24h
       FROM tokens WHERE status = 'ACTIVE' AND trading_mode != 'PRE_LISTING'`
    );

    const [[users]] = await db.execute(
      `SELECT
         COUNT(*) as total_users,
         SUM(CASE WHEN role = 'INVESTOR' THEN 1 ELSE 0 END) as investors,
         SUM(CASE WHEN role = 'ISSUER' THEN 1 ELSE 0 END) as issuers,
         SUM(CASE WHEN role = 'PARTNER' THEN 1 ELSE 0 END) as partners
       FROM users WHERE is_active = TRUE`
    );

    const [[submissions]] = await db.execute(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'ADMIN_APPROVED' THEN 1 ELSE 0 END) as approved
       FROM data_submissions`
    );

    res.json({ market, users, submissions, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
