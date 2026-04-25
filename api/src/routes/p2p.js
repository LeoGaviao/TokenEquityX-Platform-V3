const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { sendMessage }  = require('../utils/messenger');

// ── GET /api/p2p — list open offers, optionally filter by symbol
router.get('/', authenticate, async (req, res) => {
  try {
    const { symbol } = req.query;
    let sql = `
      SELECT o.*,
             u.full_name  AS seller_name,
             u.email      AS seller_email,
             t.token_name, t.asset_type, t.current_price_usd
      FROM p2p_offers o
      JOIN users  u ON u.id  = o.seller_id
      JOIN tokens t ON t.id  = o.token_id
      WHERE o.status = 'OPEN'
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
    `;
    const params = [];
    if (symbol) {
      sql += ' AND o.token_symbol = ?';
      params.push(symbol.toUpperCase());
    }
    sql += ' ORDER BY o.created_at DESC';
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch P2P offers: ' + err.message });
  }
});

// ── GET /api/p2p/my — seller's own offers
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT o.*, t.token_name, t.asset_type, t.current_price_usd
      FROM p2p_offers o
      JOIN tokens t ON t.id = o.token_id
      WHERE o.seller_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch your offers: ' + err.message });
  }
});

// ── POST /api/p2p — create a new P2P offer
router.post('/', authenticate, async (req, res) => {
  const { token_symbol, quantity, price_per_token, notes, expires_days } = req.body;
  if (!token_symbol || !quantity || !price_per_token) {
    return res.status(400).json({ error: 'token_symbol, quantity and price_per_token are required' });
  }
  const qty   = parseFloat(quantity);
  const price = parseFloat(price_per_token);
  const total = parseFloat((qty * price).toFixed(2));
  if (qty <= 0 || price <= 0) {
    return res.status(400).json({ error: 'Quantity and price must be positive' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Verify token exists and is P2P
    const [tokens] = await conn.execute(
      'SELECT * FROM tokens WHERE token_symbol = ?', [token_symbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Token not found' });
    }
    const token = tokens[0];

    // Verify seller holds enough tokens
    const [holdings] = await conn.execute(
      'SELECT * FROM token_holdings WHERE user_id = ? AND token_id = ?',
      [req.user.userId, token.id]
    );
    if (holdings.length === 0 || parseFloat(holdings[0].balance) - parseFloat(holdings[0].reserved || 0) < qty) {
      await conn.rollback();
      return res.status(400).json({ error: `Insufficient token balance. You hold ${holdings[0]?.balance || 0} ${token_symbol} tokens.` });
    }

    // Reserve the tokens
    await conn.execute(
      'UPDATE token_holdings SET reserved = COALESCE(reserved, 0) + ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
      [qty, req.user.userId, token.id]
    );

    // Calculate expiry
    const expiresAt = expires_days
      ? new Date(Date.now() + parseInt(expires_days) * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString(); // 30 days default

    // Create the offer
    await conn.execute(`
      INSERT INTO p2p_offers
        (token_id, token_symbol, seller_id, quantity, price_per_token, total_value, status, notes, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
    `, [token.id, token_symbol.toUpperCase(), req.user.userId, qty, price, total, notes || null, expiresAt]);

    await conn.commit();
    res.json({
      success: true,
      message: `P2P offer created: ${qty} ${token_symbol} at $${price.toFixed(4)} each. Total: $${total.toFixed(2)}`,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Could not create offer: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/p2p/:id/accept — buyer accepts an offer
router.put('/:id/accept', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch offer
    const [offers] = await conn.execute(
      "SELECT * FROM p2p_offers WHERE id = ? AND status = 'OPEN'", [req.params.id]
    );
    if (offers.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Offer not found or no longer available' });
    }
    const offer = offers[0];

    // Can't buy your own offer
    if (offer.seller_id === req.user.userId) {
      await conn.rollback();
      return res.status(400).json({ error: 'You cannot accept your own offer' });
    }

    const qty   = parseFloat(offer.quantity);
    const total = parseFloat(offer.total_value);

    // Check buyer wallet balance
    const [wallets] = await conn.execute(
      'SELECT * FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );
    if (wallets.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No wallet found. Please make a deposit first.' });
    }
    const wallet    = wallets[0];
    const available = parseFloat(wallet.balance_usd) - parseFloat(wallet.reserved_usd || 0);
    if (available < total) {
      await conn.rollback();
      return res.status(400).json({ error: `Insufficient balance. You need $${total.toFixed(2)} but have $${available.toFixed(2)} available.` });
    }

    // Debit buyer wallet
    await conn.execute(
      'UPDATE investor_wallets SET balance_usd = balance_usd - ?, updated_at = NOW() WHERE user_id = ?',
      [total, req.user.userId]
    );

    // Credit seller wallet (create if not exists)
    const [sellerWallets] = await conn.execute(
      'SELECT * FROM investor_wallets WHERE user_id = ?', [offer.seller_id]
    );
    if (sellerWallets.length === 0) {
      await conn.execute(
        'INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd) VALUES (gen_random_uuid(), ?, ?, 0, 0)',
        [offer.seller_id, total]
      );
    } else {
      await conn.execute(
        'UPDATE investor_wallets SET balance_usd = balance_usd + ?, updated_at = NOW() WHERE user_id = ?',
        [total, offer.seller_id]
      );
    }

    // Transfer tokens: deduct from seller holding
    await conn.execute(
      'UPDATE token_holdings SET balance = balance - ?, reserved = COALESCE(reserved,0) - ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
      [qty, qty, offer.seller_id, offer.token_id]
    );

    // Add to buyer holding
    const [buyerHoldings] = await conn.execute(
      'SELECT * FROM token_holdings WHERE user_id = ? AND token_id = ?',
      [req.user.userId, offer.token_id]
    );
    if (buyerHoldings.length === 0) {
      await conn.execute(
        'INSERT INTO token_holdings (id, user_id, token_id, balance, reserved, average_cost_usd) VALUES (gen_random_uuid(), ?, ?, ?, 0, ?)',
        [req.user.userId, offer.token_id, qty, offer.price_per_token]
      );
    } else {
      const existBal = parseFloat(buyerHoldings[0].balance);
      const existAvg = parseFloat(buyerHoldings[0].average_cost_usd);
      const newBal   = existBal + qty;
      const newAvg   = ((existBal * existAvg) + (qty * parseFloat(offer.price_per_token))) / newBal;
      await conn.execute(
        'UPDATE token_holdings SET balance = ?, average_cost_usd = ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
        [newBal, newAvg.toFixed(6), req.user.userId, offer.token_id]
      );
    }

    // Mark offer as accepted
    await conn.execute(
      "UPDATE p2p_offers SET status = 'ACCEPTED', buyer_id = ?, accepted_at = NOW(), updated_at = NOW() WHERE id = ?",
      [req.user.userId, req.params.id]
    );

    // Notify seller
    await sendMessage({
      recipientId: offer.seller_id,
      subject:     `✅ P2P Offer Accepted — ${offer.token_symbol}`,
      body:        `Your P2P offer of ${qty} ${offer.token_symbol} at $${parseFloat(offer.price_per_token).toFixed(4)} per token has been accepted. $${total.toFixed(2)} USD has been credited to your wallet.`,
      type:        'SYSTEM',
      category:    'TRADE',
      referenceId: offer.id,
    }).catch(() => {});

    await conn.commit();
    res.json({
      success:      true,
      message:      `Successfully purchased ${qty} ${offer.token_symbol} for $${total.toFixed(2)} USD.`,
      quantity:     qty,
      total,
      token_symbol: offer.token_symbol,
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Could not complete P2P transfer: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/p2p/:id/cancel — seller cancels their offer
router.put('/:id/cancel', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [offers] = await conn.execute(
      "SELECT * FROM p2p_offers WHERE id = ? AND seller_id = ? AND status = 'OPEN'",
      [req.params.id, req.user.userId]
    );
    if (offers.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Offer not found or already closed' });
    }
    const offer = offers[0];

    // Release reserved tokens
    await conn.execute(
      'UPDATE token_holdings SET reserved = GREATEST(0, COALESCE(reserved,0) - ?), updated_at = NOW() WHERE user_id = ? AND token_id = ?',
      [parseFloat(offer.quantity), req.user.userId, offer.token_id]
    );

    // Cancel offer
    await conn.execute(
      "UPDATE p2p_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Offer cancelled and tokens released.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Could not cancel offer: ' + err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
