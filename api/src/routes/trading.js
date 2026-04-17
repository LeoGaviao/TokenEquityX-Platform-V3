const router   = require('express').Router();
const db       = require('../db/pool');
const logger   = require('../utils/logger');
const { matchOrders } = require('../services/matching');
const { authenticate }            = require('../middleware/auth');
const { requireKYC }              = require('../middleware/roles');
const { v4: uuidv4 }              = require('uuid');

// POST /api/trading/order — place an order
router.post('/order', authenticate, requireKYC, async (req, res) => {
  const { tokenSymbol, side, orderType, quantity, limitPrice } = req.body;

  if (!tokenSymbol || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['BUY', 'SELL'].includes(side)) {
    return res.status(400).json({ error: 'Side must be BUY or SELL' });
  }

  try {
    const [tokens] = await db.execute(
      'SELECT * FROM tokens WHERE symbol = ? OR token_symbol = ?',
      [tokenSymbol.toUpperCase(), tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    if (!['FULL_TRADING','LIMITED_TRADING'].includes(tokens[0].market_state)) {
      return res.status(400).json({
        error:       'Trading not available',
        marketState: tokens[0].market_state
      });
    }

    const orderId = uuidv4();
    await db.execute(`
      INSERT INTO orders
        (id, token_id, user_id, side, order_type,
         quantity, filled_qty, limit_price, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'OPEN')
    `, [
      orderId, tokens[0].id, req.user.userId,
      side, orderType || 'LIMIT',
      quantity, limitPrice || null
    ]);

    // Run matching engine
    await matchOrders(tokens[0].id, db);

    res.json({
      success:    true,
      orderId,
      side,
      quantity,
      limitPrice,
      status:     'OPEN'
    });
  } catch (err) {
    logger.error('Order placement failed', { error: err.message });
    res.status(500).json({ error: 'Failed to place order: ' + err.message });
  }
});

// GET /api/trading/orderbook/:tokenSymbol — order book
router.get('/orderbook/:tokenSymbol', async (req, res) => {
  try {
    const [tokens] = await db.execute(
      'SELECT id FROM tokens WHERE symbol = ? OR token_symbol = ?',
      [req.params.tokenSymbol.toUpperCase(), req.params.tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const [bids] = await db.execute(`
      SELECT o.id, o.quantity, o.filled_qty, o.limit_price, o.created_at
      FROM orders o
      WHERE o.token_id = ? AND o.side = 'BUY'
      AND o.status IN ('OPEN','PARTIAL')
      ORDER BY o.limit_price DESC, o.created_at ASC
      LIMIT 20
    `, [tokens[0].id]);

    const [asks] = await db.execute(`
      SELECT o.id, o.quantity, o.filled_qty, o.limit_price, o.created_at
      FROM orders o
      WHERE o.token_id = ? AND o.side = 'SELL'
      AND o.status IN ('OPEN','PARTIAL')
      ORDER BY o.limit_price ASC, o.created_at ASC
      LIMIT 20
    `, [tokens[0].id]);

    const [recentTrades] = await db.execute(`
      SELECT t.id, t.quantity, t.price, t.total_usdc, t.matched_at
      FROM trades t
      WHERE t.token_id = ?
      ORDER BY t.matched_at DESC
      LIMIT 20
    `, [tokens[0].id]);

    res.json({ bids, asks, recentTrades });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch order book' });
  }
});

// GET /api/trading/orders — get current user's orders
router.get('/orders', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT o.*, t.symbol as token_symbol, t.name as token_name
      FROM orders o
      JOIN tokens t ON t.id = o.token_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 50
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch orders' });
  }
});

// PUT /api/trading/orders/:orderId/cancel — cancel an order
router.put('/orders/:orderId/cancel', authenticate, async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.orderId, req.user.userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (orders[0].status !== 'OPEN') {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    await db.execute(
      "UPDATE orders SET status = 'CANCELLED' WHERE id = ?",
      [req.params.orderId]
    );
    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Could not cancel order' });
  }
});

// GET /api/trading/candles/:tokenSymbol — OHLCV data for charts
router.get('/candles/:tokenSymbol', async (req, res) => {
  try {
    const [tokens] = await db.execute(
      'SELECT id FROM tokens WHERE symbol = ? OR token_symbol = ?',
      [req.params.tokenSymbol.toUpperCase(), req.params.tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const [rows] = await db.execute(`
      SELECT
        DATE_FORMAT(matched_at, '%Y-%m-%d %H:00:00') as time,
        MIN(price)      as low,
        MAX(price)      as high,
        SUM(total_usdc) as volume,
        (SELECT price FROM trades t2
         WHERE t2.token_id = t.token_id
         AND date_trunc('hour', t2.matched_at) =
             date_trunc('hour', t.matched_at)
         ORDER BY t2.matched_at ASC LIMIT 1) as open,
        (SELECT price FROM trades t3
         WHERE t3.token_id = t.token_id
         AND date_trunc('hour', t3.matched_at) =
             date_trunc('hour', t.matched_at)
         ORDER BY t3.matched_at DESC LIMIT 1) as close
      FROM trades t
      WHERE t.token_id = ?
      AND t.matched_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE_FORMAT(matched_at, '%Y-%m-%d %H:00:00')
      ORDER BY time ASC
    `, [tokens[0].id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch candle data' });
  }
});

// GET /api/trading/recent — dashboard alias
router.get('/recent', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    const [rows] = await db.execute(`
      SELECT t.id, t.quantity, t.price, t.total_usdc,
             t.matched_at, tk.token_symbol, tk.token_name
      FROM trades t
      LEFT JOIN tokens tk ON tk.id::VARCHAR = t.token_id
      ORDER BY t.matched_at DESC
      LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch recent trades' });
  }
});

// GET /api/trading/history/:walletAddress — user trade history
router.get('/history/:walletAddress', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    // Support both wallet address and user ID lookups
    const [userRows] = await db.execute(
      'SELECT id FROM users WHERE wallet = ? OR id = ?',
      [req.params.walletAddress.toLowerCase(), req.params.walletAddress]
    );
    if (userRows.length === 0) return res.json([]);

    const [rows] = await db.execute(`
      SELECT t.id, t.quantity, t.price, t.total_usdc,
             t.matched_at as settled_at,
             tk.token_symbol, tk.token_name,
             o.side
      FROM trades t
      LEFT JOIN tokens tk ON tk.id::VARCHAR = t.token_id
      JOIN orders o  ON (o.id = t.buy_order_id OR o.id = t.sell_order_id)
                     AND o.user_id = ?
      ORDER BY t.matched_at DESC
      LIMIT ?
    `, [userRows[0].id, limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

module.exports = router;