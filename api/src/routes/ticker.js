const router = require('express').Router();
const db     = require('../db/pool');

// GET /api/ticker — live ticker data for all active tokens
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        t.token_symbol,
        t.token_name,
        t.current_price_usd,
        t.issued_shares,
        t.market_state,
        s.legal_name  as company_name,
        s.sector,
        s.jurisdiction,
        COALESCE((
          SELECT SUM(tr.total_usdc)
          FROM trades tr
          WHERE tr.token_id = t.id
          AND tr.matched_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ), 0) as volume_24h,
        COALESCE((
          SELECT tr.price FROM trades tr
          WHERE tr.token_id = t.id
          ORDER BY tr.matched_at DESC LIMIT 1
        ), t.current_price_usd) as last_price,
        COALESCE((
          SELECT tr.price FROM trades tr
          WHERE tr.token_id = t.id
          AND tr.matched_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          ORDER BY tr.matched_at DESC LIMIT 1
        ), t.current_price_usd) as price_24h_ago
      FROM tokens t
      JOIN spvs s ON s.id = t.spv_id
      WHERE t.status IN ('ACTIVE','DRAFT')
      ORDER BY t.created_at DESC
    `);

    const ticker = rows.map(row => {
      const current  = Number(row.last_price)    || Number(row.current_price_usd) || 0;
      const previous = Number(row.price_24h_ago) || current;
      const change   = previous > 0
        ? ((current - previous) / previous) * 100
        : 0;

      return {
        symbol:      row.token_symbol,
        name:        row.token_name,
        company:     row.company_name,
        sector:      row.sector,
        jurisdiction: row.jurisdiction,
        marketState: row.market_state,
        price:       current.toFixed(4),
        change24h:   change.toFixed(2),
        volume24h:   Number(row.volume_24h).toFixed(2),
        marketCap:   (current * Number(row.issued_shares)).toFixed(2)
      };
    });

    res.json(ticker);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch ticker data' });
  }
});

module.exports = router;