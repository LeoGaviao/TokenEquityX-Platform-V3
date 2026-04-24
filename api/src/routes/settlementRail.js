const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// PUT /api/wallet/settlement-rail — set preferred settlement rail
router.put('/settlement-rail', authenticate, async (req, res) => {
  const { rail } = req.body;
  if (!['FIAT', 'USDC'].includes(rail)) {
    return res.status(400).json({ error: 'rail must be FIAT or USDC' });
  }
  try {
    const [existing] = await db.execute(
      'SELECT id FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd, settlement_rail)
         VALUES (gen_random_uuid(), ?, 0, 0, 0, ?)`,
        [req.user.userId, rail]
      );
    } else {
      await db.execute(
        'UPDATE investor_wallets SET settlement_rail = ?, updated_at = NOW() WHERE user_id = ?',
        [rail, req.user.userId]
      );
    }
    res.json({
      success: true,
      rail,
      message: rail === 'USDC'
        ? 'Settlement rail set to USDC. Ensure your USDC balance is funded before placing orders.'
        : 'Settlement rail set to FIAT. Trades will settle using your USD wallet balance.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not update settlement rail' });
  }
});

// GET /api/wallet/settlement-rail — get current rail preference
router.get('/settlement-rail', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT settlement_rail, balance_usd, balance_usdc FROM investor_wallets WHERE user_id = ?',
      [req.user.userId]
    );
    if (rows.length === 0) {
      return res.json({ rail: 'FIAT', balance_usd: 0, balance_usdc: 0 });
    }
    res.json({
      rail:         rows[0].settlement_rail || 'FIAT',
      balance_usd:  parseFloat(rows[0].balance_usd),
      balance_usdc: parseFloat(rows[0].balance_usdc),
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch settlement rail' });
  }
});

module.exports = router;
