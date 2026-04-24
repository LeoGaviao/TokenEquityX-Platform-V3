// api/src/routes/offerings.js
// Primary offering lifecycle:
// ISSUER proposes → PENDING_APPROVAL
// AUDITOR reviews → AUDITOR_REVIEWED
// ADMIN approves  → OPEN (token moves to PRIMARY_ONLY, subscriptions open)
// ADMIN closes    → DISBURSED (proceeds paid, token moves to FULL_TRADING)

const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { sendMessage }  = require('../utils/messenger');

const ISSUANCE_FEE_RATE = 0.02; // 2%

// ── GET /api/offerings — list offerings
// Admin sees all. Auditor sees PENDING_APPROVAL + AUDITOR_REVIEWED.
// Issuer sees their own. Public sees OPEN only.
router.get('/', authenticate, async (req, res) => {
  try {
    let whereClause = '';
    const params = [];

    if (req.user.role === 'ADMIN') {
      whereClause = '';
    } else if (req.user.role === 'AUDITOR' || req.user.role === 'COMPLIANCE_OFFICER') {
      whereClause = "WHERE po.status IN ('PENDING_APPROVAL','AUDITOR_REVIEWED')";
    } else if (req.user.role === 'ISSUER') {
      whereClause = 'WHERE po.issuer_id = ?';
      params.push(req.user.userId);
    } else {
      whereClause = "WHERE po.status = 'OPEN' AND po.subscription_deadline > NOW()";
    }

    const [rows] = await db.execute(`
      SELECT
        po.*,
        COALESCE(t.token_symbol, t.symbol) as token_symbol,
        COALESCE(t.token_name, t.name) as token_name,
        t.asset_type, t.current_price_usd, t.market_state,
        u.full_name AS issuer_name, u.email AS issuer_email,
        COUNT(os.id) AS subscriber_count
      FROM primary_offerings po
      JOIN tokens t ON t.id = po.token_id
      LEFT JOIN users u ON u.id = po.issuer_id
      LEFT JOIN offering_subscriptions os ON os.offering_id = po.id AND os.status = 'CONFIRMED'
      ${whereClause}
      GROUP BY po.id, t.token_symbol, t.symbol, t.token_name, t.name, t.asset_type,
               t.current_price_usd, t.market_state, u.full_name, u.email
      ORDER BY po.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch offerings: ' + err.message });
  }
});

// ── GET /api/offerings/:id — single offering
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT po.*,
             COALESCE(t.token_symbol, t.symbol) as token_symbol,
             COALESCE(t.token_name, t.name) as token_name,
             t.asset_type, t.current_price_usd, t.market_state,
             t.jurisdiction, t.spv_id,
             u.full_name AS issuer_name, u.email AS issuer_email,
             u.phone AS issuer_phone, u.city AS issuer_city, u.country AS issuer_country,
             s.legal_name AS company_name, s.description AS company_description,
             s.registration_number, s.sector,
             s.website_url, s.founded_year, s.headquarters,
             s.use_of_proceeds, s.num_employees,
             ds.data_json AS submission_data,
             ds.audit_report,
             (SELECT COUNT(*) FROM offering_subscriptions os WHERE os.offering_id = po.id AND os.status = 'CONFIRMED') AS subscriber_count
      FROM primary_offerings po
      JOIN tokens t ON t.id = po.token_id
      LEFT JOIN users u ON u.id = po.issuer_id
      LEFT JOIN spvs s ON s.id = t.spv_id
      LEFT JOIN data_submissions ds ON ds.token_symbol = t.token_symbol
        AND ds.status IN ('ADMIN_APPROVED','AUDITOR_APPROVED')
      WHERE po.id = ?
      LIMIT 1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Offering not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch offering' });
  }
});

// ── POST /api/offerings — ISSUER proposes a primary offering
router.post('/',
  authenticate,
  requireRole('ISSUER', 'ADMIN'),
  async (req, res) => {
    const {
      token_id, offering_price_usd, target_raise_usd,
      min_subscription_usd, max_subscription_usd,
      total_tokens_offered, subscription_deadline,
      offering_rationale
    } = req.body;

    if (!token_id || !offering_price_usd || !target_raise_usd ||
        !total_tokens_offered || !subscription_deadline) {
      return res.status(400).json({ error: 'token_id, offering_price_usd, target_raise_usd, total_tokens_offered and subscription_deadline are required' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Verify token belongs to this issuer (unless admin)
      const [tokens] = await conn.execute(
        `SELECT t.*, s.owner_user_id FROM tokens t
         LEFT JOIN spvs s ON s.id = t.spv_id
         WHERE t.id = ?`,
        [token_id]
      );
      if (tokens.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Token not found' }); }
      const token = tokens[0];

      // Verify token belongs to this issuer via issuer_id OR via SPV ownership
      if (req.user.role !== 'ADMIN') {
        const isOwnerViaSpv      = String(token.owner_user_id) === String(req.user.userId);
        const isOwnerViaIssuerId = String(token.issuer_id) === String(req.user.userId);
        console.log('[OFFERINGS DEBUG] owner_user_id:', token.owner_user_id, 'issuer_id:', token.issuer_id, 'userId:', req.user.userId, 'isOwnerViaSpv:', isOwnerViaSpv, 'isOwnerViaIssuerId:', isOwnerViaIssuerId);
        if (!isOwnerViaSpv && !isOwnerViaIssuerId) {
          await conn.rollback();
          return res.status(403).json({ error: 'You are not the issuer of this token', debug: { owner_user_id: token.owner_user_id, issuer_id: token.issuer_id, userId: req.user.userId } });
        }
      }

      // No duplicate open/pending offering
      const [existing] = await conn.execute(
        "SELECT id FROM primary_offerings WHERE token_id = ? AND status IN ('PENDING_APPROVAL','AUDITOR_REVIEWED','OPEN')",
        [token_id]
      );
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'An active offering already exists for this token' });
      }

      const [result] = await conn.execute(`
        INSERT INTO primary_offerings (
          token_id, issuer_id, offering_price_usd, target_raise_usd,
          min_subscription_usd, max_subscription_usd,
          total_tokens_offered, issuance_fee_rate,
          subscription_deadline, offering_rationale, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
      `, [
        token_id,
        req.user.userId,
        offering_price_usd, target_raise_usd,
        min_subscription_usd || 100,
        max_subscription_usd || null,
        total_tokens_offered,
        ISSUANCE_FEE_RATE,
        new Date(subscription_deadline),
        offering_rationale || null
      ]);

      await conn.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_PROPOSED', ?, ?, ?)`,
        [req.user.userId, `token:${token_id}`,
         `Offering proposed for ${token.symbol}. Price: $${offering_price_usd}. Target: $${target_raise_usd}`]
      );

      await conn.commit();
      res.status(201).json({
        success: true,
        offering_id: result.insertId,
        status: 'PENDING_APPROVAL',
        message: `Offering proposal submitted for ${token.symbol}. Awaiting auditor review and admin approval.`
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not create offering: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── PUT /api/offerings/:id/auditor-review — AUDITOR reviews the offering
router.put('/:id/auditor-review',
  authenticate,
  requireRole('AUDITOR', 'ADMIN', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { recommendation, auditor_notes, price_assessment } = req.body;
    // recommendation: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
    if (!recommendation) return res.status(400).json({ error: 'recommendation is required' });

    try {
      const [rows] = await db.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Offering not found' });
      if (rows[0].status !== 'PENDING_APPROVAL') {
        return res.status(400).json({ error: 'Offering is not awaiting auditor review' });
      }

      await db.execute(`
        UPDATE primary_offerings SET
          status            = 'AUDITOR_REVIEWED',
          auditor_id        = ?,
          auditor_notes     = ?,
          auditor_recommendation = ?,
          price_assessment  = ?,
          auditor_reviewed_at = NOW(),
          updated_at        = NOW()
        WHERE id = ?
      `, [req.user.userId, auditor_notes || null, recommendation, price_assessment || null, req.params.id]);

      await db.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_AUDITOR_REVIEWED', ?, ?, ?)`,
        [req.user.userId, `offering:${req.params.id}`,
         `Auditor recommendation: ${recommendation}. ${auditor_notes || ''}`]
      );

      res.json({ success: true, recommendation, message: `Auditor review submitted: ${recommendation}` });
    } catch (err) {
      res.status(500).json({ error: 'Could not submit review: ' + err.message });
    }
  }
);

// ── PUT /api/offerings/:id/approve — ADMIN approves and opens the offering
router.put('/:id/approve',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { admin_notes } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
      if (rows.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Offering not found' }); }
      const offering = rows[0];

      if (!['PENDING_APPROVAL', 'AUDITOR_REVIEWED'].includes(offering.status)) {
        await conn.rollback();
        return res.status(400).json({ error: `Offering cannot be approved from status: ${offering.status}` });
      }

      // Open the offering
      await conn.execute(`
        UPDATE primary_offerings SET
          status       = 'OPEN',
          approved_by  = ?,
          approved_at  = NOW(),
          admin_notes  = ?,
          updated_at   = NOW()
        WHERE id = ?
      `, [req.user.userId, admin_notes || null, req.params.id]);

      // Move token to PRIMARY_ONLY
      await conn.execute(
        "UPDATE tokens SET market_state = 'PRIMARY_ONLY', status = 'ACTIVE', updated_at = NOW() WHERE id = ?",
        [offering.token_id]
      );

      await conn.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_APPROVED', ?, ?, ?)`,
        [req.user.userId, `offering:${req.params.id}`, `Offering approved and opened. Token moved to PRIMARY_ONLY.`]
      );

      await conn.commit();
      res.json({ success: true, message: 'Offering approved and opened. Investors can now subscribe.' });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not approve offering: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── PUT /api/offerings/:id/reject — ADMIN rejects the offering proposal
router.put('/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { reason } = req.body;
    try {
      const [rows] = await db.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Offering not found' });
      if (!['PENDING_APPROVAL', 'AUDITOR_REVIEWED'].includes(rows[0].status)) {
        return res.status(400).json({ error: 'Offering cannot be rejected from its current status' });
      }

      await db.execute(
        "UPDATE primary_offerings SET status = 'CANCELLED', admin_notes = ?, updated_at = NOW() WHERE id = ?",
        [reason || 'Rejected by admin', req.params.id]
      );
      await db.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_REJECTED', ?, ?, ?)`,
        [req.user.userId, `offering:${req.params.id}`, `Offering rejected. Reason: ${reason || 'Not specified'}`]
      );

      res.json({ success: true, message: 'Offering rejected.' });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject offering: ' + err.message });
    }
  }
);

// ── POST /api/offerings/:id/subscribe — INVESTOR subscribes
router.post('/:id/subscribe',
  authenticate,
  async (req, res) => {
    const { amount_usd } = req.body;
    if (!amount_usd || parseFloat(amount_usd) <= 0) {
      return res.status(400).json({ error: 'amount_usd is required and must be positive' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [offerings] = await conn.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
      if (offerings.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Offering not found' }); }
      const offering = offerings[0];

      if (offering.status !== 'OPEN') {
        await conn.rollback();
        return res.status(400).json({ error: 'This offering is not open for subscriptions' });
      }
      if (new Date() > new Date(offering.subscription_deadline)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Subscription deadline has passed' });
      }

      const subscribeAmount = parseFloat(amount_usd);
      if (subscribeAmount < parseFloat(offering.min_subscription_usd)) {
        await conn.rollback();
        return res.status(400).json({ error: `Minimum subscription is $${offering.min_subscription_usd}` });
      }
      if (offering.max_subscription_usd && subscribeAmount > parseFloat(offering.max_subscription_usd)) {
        await conn.rollback();
        return res.status(400).json({ error: `Maximum subscription is $${offering.max_subscription_usd}` });
      }

      const [existingSub] = await conn.execute(
        "SELECT id FROM offering_subscriptions WHERE offering_id = ? AND investor_id = ? AND status != 'CANCELLED'",
        [req.params.id, req.user.userId]
      );
      if (existingSub.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'You have already subscribed to this offering' });
      }

      const [wallets] = await conn.execute(
        'SELECT * FROM investor_wallets WHERE user_id = ?', [req.user.userId]
      );
      if (wallets.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'No wallet found. Please make a deposit first.' });
      }
      const wallet = wallets[0];
      const rail = wallet.settlement_rail || 'FIAT';
      const availableBalance = rail === 'USDC'
        ? parseFloat(wallet.balance_usdc)
        : parseFloat(wallet.balance_usd) - parseFloat(wallet.reserved_usd);

      if (availableBalance < subscribeAmount) {
        await conn.rollback();
        return res.status(400).json({
          error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required: $${subscribeAmount.toFixed(2)}`
        });
      }

      const tokensAllocated = Math.floor(subscribeAmount / parseFloat(offering.offering_price_usd));

      // Reserve funds
      if (rail === 'USDC') {
        await conn.execute(
          'UPDATE investor_wallets SET balance_usdc = balance_usdc - ?, updated_at = NOW() WHERE user_id = ?',
          [subscribeAmount, req.user.userId]
        );
      } else {
        await conn.execute(
          'UPDATE investor_wallets SET reserved_usd = reserved_usd + ?, updated_at = NOW() WHERE user_id = ?',
          [subscribeAmount, req.user.userId]
        );
      }

      await conn.execute(`
        INSERT INTO offering_subscriptions
          (offering_id, investor_id, amount_usd, tokens_allocated, settlement_rail, status)
        VALUES (?, ?, ?, ?, ?, 'CONFIRMED')
      `, [req.params.id, req.user.userId, subscribeAmount, tokensAllocated, rail]);

      await conn.execute(`
        UPDATE primary_offerings
        SET tokens_subscribed = tokens_subscribed + ?,
            total_raised_usd  = total_raised_usd  + ?,
            updated_at = NOW()
        WHERE id = ?
      `, [tokensAllocated, subscribeAmount, req.params.id]);

      await conn.execute(`
        INSERT INTO wallet_transactions
          (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
        VALUES (gen_random_uuid(), ?, 'ADJUSTMENT', ?, ?, ?, ?, ?)
      `, [
        req.user.userId, -subscribeAmount,
        availableBalance, availableBalance - subscribeAmount,
        null,
        `Primary offering subscription — ${tokensAllocated} tokens @ $${offering.offering_price_usd}`
      ]);

      await conn.commit();

      // Notify issuer of new subscription
      await sendMessage({
        recipientId: offering.issuer_id,
        subject:     `📈 New Subscription — ${offering.token_symbol || 'Your Offering'}`,
        body:        `A new subscription of $${parseFloat(subscribeAmount).toFixed(2)} USD has been received for your offering. Total raised so far: $${(parseFloat(offering.total_raised_usd) + subscribeAmount).toFixed(2)} USD.`,
        type:        'SYSTEM',
        category:    'OFFERING',
        referenceId: String(req.params.id),
      }).catch(() => {});

      res.json({
        success: true,
        subscription_id: null,
        tokens_allocated: tokensAllocated,
        amount_usd: subscribeAmount,
        message: `Subscribed successfully. ${tokensAllocated} tokens reserved for you.`
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Subscription failed: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── POST /api/offerings/:id/close — ADMIN closes and disburses
router.post('/:id/close',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { bank_reference, admin_notes, trading_mode } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [offerings] = await conn.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
      if (offerings.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Offering not found' }); }
      const offering = offerings[0];
      if (offering.status !== 'OPEN') { await conn.rollback(); return res.status(400).json({ error: `Offering is already ${offering.status}` }); }

      const [tokens] = await conn.execute('SELECT * FROM tokens WHERE id = ?', [offering.token_id]);
      if (tokens.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Token not found' }); }
      const token = tokens[0];

      const totalRaised = parseFloat(offering.total_raised_usd);
      const issuanceFee = parseFloat((totalRaised * parseFloat(offering.issuance_fee_rate)).toFixed(2));
      const netProceeds = parseFloat((totalRaised - issuanceFee).toFixed(2));

      const [subscriptions] = await conn.execute(
        "SELECT * FROM offering_subscriptions WHERE offering_id = ? AND status = 'CONFIRMED'",
        [req.params.id]
      );

      // Allocate tokens to subscribers
      for (const sub of subscriptions) {
        const [holdingRows] = await conn.execute(
          'SELECT * FROM token_holdings WHERE user_id = ? AND token_id = ?',
          [sub.investor_id, offering.token_id]
        );
        if (holdingRows.length === 0) {
          await conn.execute(
            `INSERT INTO token_holdings (id, user_id, token_id, balance, reserved, average_cost_usd)
             VALUES (gen_random_uuid(), ?, ?, ?, 0, ?)`,
            [sub.investor_id, offering.token_id, sub.tokens_allocated, offering.offering_price_usd]
          );
        } else {
          const existingBal = parseFloat(holdingRows[0].balance);
          const existingAvg = parseFloat(holdingRows[0].average_cost_usd);
          const newBal      = existingBal + sub.tokens_allocated;
          const newAvgCost  = ((existingBal * existingAvg) + (sub.tokens_allocated * parseFloat(offering.offering_price_usd))) / newBal;
          await conn.execute(
            'UPDATE token_holdings SET balance = ?, average_cost_usd = ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
            [newBal, newAvgCost.toFixed(6), sub.investor_id, offering.token_id]
          );
        }

        // Debit fiat balance (USDC was debited at subscription time)
        if (sub.settlement_rail === 'FIAT') {
          const [iw] = await conn.execute('SELECT * FROM investor_wallets WHERE user_id = ?', [sub.investor_id]);
          if (iw.length > 0) {
            const newBal = parseFloat((parseFloat(iw[0].balance_usd) - sub.amount_usd).toFixed(2));
            const newRes = parseFloat(Math.max(0, parseFloat(iw[0].reserved_usd) - sub.amount_usd).toFixed(2));
            await conn.execute(
              'UPDATE investor_wallets SET balance_usd = ?, reserved_usd = ?, updated_at = NOW() WHERE user_id = ?',
              [newBal, newRes, sub.investor_id]
            );
          }
        }

        await conn.execute(
          "UPDATE offering_subscriptions SET confirmed_at = NOW() WHERE id = ?",
          [sub.id]
        );
      }

      // Credit issuer wallet with net proceeds
      const [issuerWallets] = await conn.execute(
        'SELECT * FROM investor_wallets WHERE user_id = ?', [offering.issuer_id]
      );
      if (issuerWallets.length === 0) {
        await conn.execute(
          `INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd)
           VALUES (gen_random_uuid(), ?, ?, 0, 0)`,
          [offering.issuer_id, netProceeds]
        );
      } else {
        const issuerCurrentBal = parseFloat(issuerWallets[0].balance_usd);
        const issuerNewBal     = parseFloat((issuerCurrentBal + netProceeds).toFixed(2));
        await conn.execute(
          'UPDATE investor_wallets SET balance_usd = ?, updated_at = NOW() WHERE user_id = ?',
          [issuerNewBal, offering.issuer_id]
        );
        await conn.execute(`
          INSERT INTO wallet_transactions
            (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
          VALUES (gen_random_uuid(), ?, 'ADJUSTMENT', ?, ?, ?, ?, ?)
        `, [
          offering.issuer_id, netProceeds, issuerCurrentBal, issuerNewBal,
          String(offering.id),
          `Primary offering proceeds — ${token.symbol}. Gross: $${totalRaised.toFixed(2)}, Fee (2%): $${issuanceFee.toFixed(2)}, Net: $${netProceeds.toFixed(2)}`
        ]);
      }

      // Credit platform treasury
      await conn.execute(
        'UPDATE platform_treasury SET usd_liability = usd_liability + ?, updated_at = NOW() WHERE id = 1',
        [issuanceFee]
      );

      const newTradingMode = trading_mode || 'FULL_TRADING';
      await conn.execute(`
        UPDATE primary_offerings SET
          status = 'DISBURSED', issuance_fee_usd = ?, net_proceeds_usd = ?,
          closed_at = NOW(), disbursed_at = NOW(), disbursed_by = ?,
          bank_reference = ?, admin_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [issuanceFee, netProceeds, req.user.userId, bank_reference || null, admin_notes || null, req.params.id]);

      await conn.execute(
        'UPDATE tokens SET market_state = ?, trading_mode = ?, listed_at = NOW(), updated_at = NOW() WHERE id = ?',
        ['FULL_TRADING', newTradingMode, offering.token_id]
      );

      await conn.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_CLOSED_DISBURSED', ?, ?, ?)`,
        [req.user.userId, `offering:${offering.id}`,
         `Closed. Raised: $${totalRaised}, Fee: $${issuanceFee}, Net to issuer: $${netProceeds}. ${subscriptions.length} investors. Token → ${newTradingMode}`]
      );

      await conn.commit();

      await sendMessage({
        recipientId: offering.issuer_id,
        subject:     `🎉 Offering Closed — Funds Disbursed`,
        body:        `Your primary offering has closed successfully. Total raised: $${totalRaised.toFixed(2)} USD. Net proceeds after fees: $${netProceeds.toFixed(2)} USD. Your tokens are now live for secondary market trading.`,
        type:        'SYSTEM',
        category:    'OFFERING',
        referenceId: String(req.params.id),
      }).catch(() => {});

      res.json({
        success: true,
        summary: {
          token_symbol: token.symbol, total_raised_usd: totalRaised,
          issuance_fee_usd: issuanceFee, net_proceeds_usd: netProceeds,
          subscribers: subscriptions.length, tokens_allocated: offering.tokens_subscribed,
          trading_mode: newTradingMode
        },
        message: `Offering closed. $${netProceeds.toFixed(2)} credited to issuer. ${token.symbol} is now live for trading.`
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not close offering: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── POST /api/offerings/:id/cancel — ADMIN cancels and refunds
router.post('/:id/cancel',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { reason } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [offerings] = await conn.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
      if (offerings.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Offering not found' }); }
      const offering = offerings[0];
      if (offering.status !== 'OPEN') { await conn.rollback(); return res.status(400).json({ error: `Offering is already ${offering.status}` }); }

      const [subscriptions] = await conn.execute(
        "SELECT * FROM offering_subscriptions WHERE offering_id = ? AND status = 'CONFIRMED'",
        [req.params.id]
      );

      for (const sub of subscriptions) {
        const [wallets] = await conn.execute('SELECT * FROM investor_wallets WHERE user_id = ?', [sub.investor_id]);
        if (wallets.length > 0) {
          if (sub.settlement_rail === 'FIAT') {
            await conn.execute(
              'UPDATE investor_wallets SET reserved_usd = reserved_usd - ?, updated_at = NOW() WHERE user_id = ?',
              [sub.amount_usd, sub.investor_id]
            );
          } else {
            await conn.execute(
              'UPDATE investor_wallets SET balance_usdc = balance_usdc + ?, updated_at = NOW() WHERE user_id = ?',
              [sub.amount_usd, sub.investor_id]
            );
          }
          await conn.execute(`
            INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
            VALUES (gen_random_uuid(), ?, 'REFUND', ?, ?, ?, ?, ?)
          `, [sub.investor_id, sub.amount_usd,
              parseFloat(wallets[0].balance_usd), parseFloat(wallets[0].balance_usd) + sub.amount_usd,
              String(sub.id), `Offering cancelled — refund of $${sub.amount_usd}`]);
        }
        await conn.execute("UPDATE offering_subscriptions SET status = 'REFUNDED', refunded_at = NOW() WHERE id = ?", [sub.id]);
      }

      await conn.execute(
        "UPDATE primary_offerings SET status = 'CANCELLED', closed_at = NOW(), admin_notes = ?, updated_at = NOW() WHERE id = ?",
        [reason || 'Cancelled by admin', req.params.id]
      );
      await conn.execute(
        "UPDATE tokens SET market_state = 'PRE_LAUNCH', updated_at = NOW() WHERE id = ?",
        [offering.token_id]
      );

      await conn.commit();
      res.json({ success: true, refunded: subscriptions.length, message: `Offering cancelled. ${subscriptions.length} subscribers refunded.` });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not cancel offering: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── GET /api/offerings/:id/subscriptions — admin view all subscriptions
router.get('/:id/subscriptions',
  authenticate,
  requireRole('ADMIN', 'AUDITOR'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT os.*, u.full_name, u.email, u.wallet_address
        FROM offering_subscriptions os
        JOIN users u ON u.id = os.investor_id
        WHERE os.offering_id = ?
        ORDER BY os.subscribed_at ASC
      `, [req.params.id]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch subscriptions' });
    }
  }
);

router.post('/:id/send-progress', authenticate, requireRole('ADMIN', 'ISSUER'), async (req, res) => {
  try {
    const [offerings] = await db.execute('SELECT * FROM primary_offerings WHERE id = ?', [req.params.id]);
    if (offerings.length === 0) return res.status(404).json({ error: 'Offering not found' });
    const offering = offerings[0];
    const pct = offering.target_raise_usd > 0
      ? ((parseFloat(offering.total_raised_usd) / parseFloat(offering.target_raise_usd)) * 100).toFixed(1)
      : 0;
    await sendMessage({
      recipientId: offering.issuer_id,
      subject:     `📊 Offering Progress Update`,
      body:        `Your offering has raised $${parseFloat(offering.total_raised_usd).toFixed(2)} USD of the $${parseFloat(offering.target_raise_usd).toFixed(2)} USD target (${pct}%). ${offering.tokens_subscribed} tokens subscribed so far.`,
      type:        'SYSTEM',
      category:    'OFFERING',
      referenceId: String(req.params.id),
    });
    res.json({ success: true, message: 'Progress update sent to issuer.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
