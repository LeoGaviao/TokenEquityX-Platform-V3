const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }  = require('../middleware/auth');
const { requireRole }   = require('../middleware/roles');
const { v4: uuidv4 }    = require('uuid');

// POST /api/oracle/submit — submit price for review
router.post('/submit', authenticate, requireRole('ADMIN','ISSUER','ORACLE_UPDATER'), async (req, res) => {
  const { tokenSymbol, priceUSD, dataHash, source } = req.body;

  if (!tokenSymbol || !priceUSD) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [tokens] = await db.execute(
      'SELECT id FROM tokens WHERE token_symbol = ?',
      [tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const id = uuidv4();
    await db.execute(`
      INSERT INTO oracle_prices
        (id, token_id, price_usd, data_hash, source, status, submitted_by)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `, [id, tokens[0].id, priceUSD, dataHash, source || 'MANUAL', req.user.userId]);

    res.json({ success: true, submissionId: id });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit price' });
  }
});

// GET /api/oracle/pending — list pending price submissions
router.get('/pending',
  authenticate,
  requireRole('ADMIN','AUDITOR'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT op.*, t.token_symbol, u.wallet_address as submitted_by_wallet
        FROM oracle_prices op
        JOIN tokens t ON t.id = op.token_id
        JOIN users u  ON u.id = op.submitted_by
        WHERE op.status = 'PENDING'
        ORDER BY op.submitted_at ASC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch pending prices' });
    }
  }
);

// PUT /api/oracle/approve/:id — auditor approves price
router.put('/approve/:id',
  authenticate,
  requireRole('ADMIN','AUDITOR'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM oracle_prices WHERE id = ?', [req.params.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      await db.execute(`
        UPDATE oracle_prices
        SET status = 'APPROVED', approved_by = ?, approved_at = NOW()
        WHERE id = ?
      `, [req.user.userId, req.params.id]);

      await db.execute(
        'UPDATE tokens SET current_price_usd = ? WHERE id = ?',
        [rows[0].price_usd, rows[0].token_id]
      );

      logger.info('Oracle price approved', { submissionId: req.params.id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not approve price' });
    }
  }
);

// PUT /api/oracle/reject/:id — auditor rejects price
router.put('/reject/:id',
  authenticate,
  requireRole('ADMIN','AUDITOR'),
  async (req, res) => {
    try {
      await db.execute(
        "UPDATE oracle_prices SET status = 'REJECTED' WHERE id = ?",
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject price' });
    }
  }
);

// POST /api/oracle/set — auditor certifies a new oracle price directly
router.post('/set',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { tokenSymbol, price, source } = req.body;

    if (!tokenSymbol || !price) {
      return res.status(400).json({ error: 'tokenSymbol and price are required' });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    try {
      // Record in oracle_prices history
      await db.execute(`
        INSERT INTO oracle_prices (token_symbol, price, set_by, source)
        VALUES (?, ?, ?, ?)
      `, [
        tokenSymbol.toUpperCase(),
        parseFloat(price),
        req.user.wallet || req.user.userId,
        source || 'Auditor certification',
      ]);

      // Update live oracle price on the token
      await db.execute(`
        UPDATE tokens
        SET oracle_price = ?, current_price_usd = ?, updated_at = NOW()
        WHERE (symbol = ? OR token_symbol = ?)
      `, [
        parseFloat(price), parseFloat(price),
        tokenSymbol.toUpperCase(), tokenSymbol.toUpperCase(),
      ]);

      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['ORACLE_PRICE_SET', req.user.wallet || req.user.userId, tokenSymbol.toUpperCase(),
         `New price: $${parseFloat(price).toFixed(4)}. Source: ${source || 'Auditor'}`]
      );

      logger.info('Oracle price certified', {
        tokenSymbol: tokenSymbol.toUpperCase(),
        price: parseFloat(price),
        setBy: req.user.wallet || req.user.userId,
      });

      res.json({
        success: true,
        tokenSymbol: tokenSymbol.toUpperCase(),
        certifiedPrice: parseFloat(price),
        message: `Oracle price for ${tokenSymbol.toUpperCase()} set to $${parseFloat(price).toFixed(4)}`,
      });
    } catch (err) {
      logger.error('Oracle set failed', { error: err.message });
      res.status(500).json({ error: 'Could not set oracle price: ' + err.message });
    }
  }
);

module.exports = router;
