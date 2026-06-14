// api/src/middleware/usdcPilot.js
// Kill-switch middleware for the USDC supervised pilot (SI 99 of 2026).
// All USDC endpoints must use requireUsdcEnabled before processing requests.
// The pilot remains disabled until formal RBZ written confirmation is received.

const db = require('../db/pool');

async function requireUsdcEnabled(req, res, next) {
  try {
    const [rows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_pilot_enabled'"
    );
    if (rows[0]?.value === 'true') return next();
    return res.status(503).json({
      error: 'USDC_PILOT_DISABLED',
      message: 'USDC settlement is not currently available. The supervised pilot under Statutory Instrument 99 of 2026 is pending regulatory activation.',
    });
  } catch (err) {
    console.error('[USDC_PILOT] Kill-switch check failed:', err.message);
    return res.status(503).json({ error: 'USDC service temporarily unavailable' });
  }
}

module.exports = { requireUsdcEnabled };
