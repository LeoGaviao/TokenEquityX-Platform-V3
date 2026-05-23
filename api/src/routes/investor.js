const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate }      = require('../middleware/auth');
const { checkPremiumAccess } = require('../middleware/premiumAccess');

// GET /api/investor/premium-status
router.get('/premium-status', authenticate, async (req, res) => {
  try {
    const result = await checkPremiumAccess(req.user.userId, db);
    res.json(result);
  } catch (err) {
    console.error('[INVESTOR] premium-status error:', err.message);
    res.status(500).json({ error: 'Could not fetch premium status' });
  }
});

module.exports = router;
