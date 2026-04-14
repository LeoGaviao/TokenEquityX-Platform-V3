const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }            = require('../middleware/auth');
const { requireRole, requireKYC } = require('../middleware/roles');
const { v4: uuidv4 }              = require('uuid');

// POST /api/bonds/register — register bond parameters
router.post('/register', authenticate, requireKYC, async (req, res) => {
  const {
    tokenSymbol, faceValuePerToken, couponRateBps,
    couponFrequencyDays, maturityDate,
    earlyRedemptionAllowed, earlyRedemptionPenaltyBps
  } = req.body;

  if (!tokenSymbol || !faceValuePerToken || !maturityDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [tokens] = await db.execute(
      'SELECT t.*, s.owner_user_id FROM tokens t JOIN spvs s ON s.id = t.spv_id WHERE t.token_symbol = ?',
      [tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const bondId = uuidv4();
    const nextCoupon = new Date();
    nextCoupon.setDate(nextCoupon.getDate() + (couponFrequencyDays || 90));

    await db.execute(`
      INSERT INTO bonds
        (id, token_id, face_value_per_token, coupon_rate_bps,
         coupon_frequency_days, maturity_date, next_coupon_date,
         early_redemption_allowed, early_redemption_penalty_bps, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [
      bondId, tokens[0].id, faceValuePerToken,
      couponRateBps || 0, couponFrequencyDays || 90,
      maturityDate, nextCoupon,
      earlyRedemptionAllowed ? 1 : 0,
      earlyRedemptionPenaltyBps || 0
    ]);

    res.json({ success: true, bondId });
  } catch (err) {
    logger.error('Bond registration failed', { error: err.message });
    res.status(500).json({ error: 'Failed to register bond: ' + err.message });
  }
});

// GET /api/bonds/:tokenSymbol — get bond details
router.get('/:tokenSymbol', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT b.*, t.token_symbol, t.token_name,
             t.current_price_usd, s.legal_name as company_name
      FROM bonds b
      JOIN tokens t ON t.id = b.token_id
      JOIN spvs s   ON s.id = t.spv_id
      WHERE t.token_symbol = ?
    `, [req.params.tokenSymbol.toUpperCase()]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bond not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch bond' });
  }
});

// GET /api/bonds — list all bonds
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT b.*, t.token_symbol, t.token_name,
             t.current_price_usd, s.legal_name as company_name,
             s.jurisdiction
      FROM bonds b
      JOIN tokens t ON t.id = b.token_id
      JOIN spvs s   ON s.id = t.spv_id
      WHERE b.status IN ('ACTIVE','MATURED')
      ORDER BY b.maturity_date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch bonds' });
  }
});

// POST /api/bonds/:tokenSymbol/deposit — deposit redemption escrow
router.post('/:tokenSymbol/deposit', authenticate, requireKYC, async (req, res) => {
  const { amountUSDC } = req.body;
  if (!amountUSDC) return res.status(400).json({ error: 'Amount required' });

  try {
    const [rows] = await db.execute(`
      SELECT b.* FROM bonds b
      JOIN tokens t ON t.id = b.token_id
      WHERE t.token_symbol = ?
    `, [req.params.tokenSymbol.toUpperCase()]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bond not found' });
    }

    await db.execute(
      'UPDATE bonds SET escrow_balance_usdc = escrow_balance_usdc + ? WHERE id = ?',
      [amountUSDC, rows[0].id]
    );

    res.json({
      success:       true,
      newEscrow:     Number(rows[0].escrow_balance_usdc) + Number(amountUSDC)
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not deposit escrow' });
  }
});

module.exports = router;