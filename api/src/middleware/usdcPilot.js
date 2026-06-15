// api/src/middleware/usdcPilot.js
// Kill-switch middleware for USDC functionality.
// All USDC endpoints must use requireUsdcEnabled before processing requests.
// USDC is disabled until formal RBZ Exchange Control written authorisation is received.
// Note: SI 99 of 2026 is the VASP registration framework — it does NOT authorise USDC
// settlement. Exchange Control authorisation from the RBZ Exchange Control directorate
// is required separately before USDC functionality can be activated.

const db = require('../db/pool');

async function requireUsdcEnabled(req, res, next) {
  try {
    const [rows] = await db.execute(
      "SELECT value FROM platform_settings WHERE key = 'usdc_pilot_enabled'"
    );
    if (rows[0]?.value === 'true') return next();
    return res.status(503).json({
      error: 'USDC_PILOT_DISABLED',
      message: 'USDC settlement is not currently available. Formal written authorisation from the Reserve Bank of Zimbabwe Exchange Control directorate is required before USDC functionality can be activated.',
    });
  } catch (err) {
    console.error('[USDC_PILOT] Kill-switch check failed:', err.message);
    return res.status(503).json({ error: 'USDC service temporarily unavailable' });
  }
}

module.exports = { requireUsdcEnabled };
