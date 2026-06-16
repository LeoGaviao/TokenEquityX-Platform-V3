// api/src/routes/dividends.js
//
// Withholding tax rates (Zimbabwe Income Tax Act):
//   Zimbabwe residents     → 10%
//   Non-residents          → 15%
//
// Payout model:
//   Gross = investor token_holdings.balance × dividend_rounds.amount_per_token
//   Withholding = Gross × applicable rate
//   Net = Gross − Withholding
//   investor_wallets.balance_usd += Net
//   platform_treasury.usd_liability += Withholding (held for ZIMRA remittance)

const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }            = require('../middleware/auth');
const { requireRole, requireKYC } = require('../middleware/roles');
const { sendMessage }              = require('../utils/messenger');
const { getNumericSetting }        = require('../utils/platformSettings');

// ── Determine withholding rate from KYC nationality (reads rates dynamically from platform_settings)
async function getWithholdingRate(db, userId) {
  const whtResidentRate    = await getNumericSetting('wht_resident_rate', 0.10);
  const whtNonResidentRate = await getNumericSetting('wht_non_resident_rate', 0.15);
  try {
    const [rows] = await db.execute(
      'SELECT nationality FROM kyc_records WHERE user_id = ? AND status = ? ORDER BY submitted_at DESC LIMIT 1',
      [userId, 'APPROVED']
    );
    if (rows.length === 0) return whtNonResidentRate;
    const nationality = (rows[0].nationality || '').toLowerCase().trim();
    const isZimbabwe = nationality.includes('zimbabwe') || nationality.includes('zimbabwean');
    return isZimbabwe ? whtResidentRate : whtNonResidentRate;
  } catch {
    return whtNonResidentRate;
  }
}

// ── POST /api/dividends/create — Admin or issuer creates a dividend round
// The issuer deposits the total pool; amount_per_token drives per-investor calculation
router.post('/create',
  authenticate,
  requireRole('ADMIN', 'ISSUER'),
  async (req, res) => {
    const { tokenSymbol, roundType, totalAmountUSDC, amountPerToken, description, claimWindowDays } = req.body;

    if (!tokenSymbol || !totalAmountUSDC || !amountPerToken) {
      return res.status(400).json({ error: 'tokenSymbol, totalAmountUSDC and amountPerToken are required' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Verify token exists
      const [tokens] = await conn.execute(
        'SELECT * FROM tokens WHERE symbol = ? OR token_symbol = ?',
        [tokenSymbol.toUpperCase(), tokenSymbol.toUpperCase()]
      );
      if (tokens.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Token not found' });
      }
      const token = tokens[0];

      // Verify issuer owns this token (unless admin)
      if (req.user.role !== 'ADMIN' && token.issuer_id !== req.user.userId) {
        await conn.rollback();
        return res.status(403).json({ error: 'Not authorised for this token' });
      }

      // Debit issuer wallet for the distribution pool
      const [issuerWallets] = await conn.execute(
        'SELECT * FROM investor_wallets WHERE user_id = ?', [token.issuer_id || req.user.userId]
      );
      if (issuerWallets.length > 0) {
        const issuerBal = parseFloat(issuerWallets[0].balance_usd);
        const pool      = parseFloat(totalAmountUSDC);
        if (issuerBal < pool) {
          await conn.rollback();
          return res.status(400).json({
            error: `Insufficient issuer balance. Available: $${issuerBal.toFixed(2)}, Required: $${pool.toFixed(2)}`
          });
        }
        await conn.execute(
          'UPDATE investor_wallets SET balance_usd = balance_usd - ?, updated_at = NOW() WHERE user_id = ?',
          [pool, token.issuer_id || req.user.userId]
        );
        await conn.execute(`
          INSERT INTO wallet_transactions
            (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
          VALUES (gen_random_uuid(), ?, 'ADJUSTMENT', ?, ?, ?, ?, ?)
        `, [
          token.issuer_id || req.user.userId,
          -pool, issuerBal, issuerBal - pool,
          tokenSymbol,
          `${roundType || 'Dividend'} distribution pool funded — ${tokenSymbol}`
        ]);
      }

      const claimDeadline = new Date(
        Date.now() + (Number(claimWindowDays) || 30) * 24 * 60 * 60 * 1000
      );

      const [result] = await conn.execute(`
        INSERT INTO dividend_rounds
          (token_symbol, round_type, description, total_amount_usdc, amount_per_token, claim_deadline, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)
      `, [
        tokenSymbol.toUpperCase(),
        roundType || 'DIVIDEND',
        description || null,
        totalAmountUSDC,
        amountPerToken,
        claimDeadline,
        req.user.userId
      ]);

      await conn.commit();
      logger.info('Dividend round created', { roundId: result.insertId, tokenSymbol });

      // Notify all token holders
      try {
        const [holders] = await db.execute(
          'SELECT DISTINCT user_id FROM token_holdings WHERE token_id = ? AND balance > 0',
          [token.id]
        );
        for (const holder of holders) {
          await sendMessage({
            recipientId: holder.user_id,
            subject:     `💰 Dividend Declared — ${tokenSymbol.toUpperCase()}`,
            body:        `A dividend of $${parseFloat(amountPerToken).toFixed(6)} per token has been declared for ${tokenSymbol.toUpperCase()}. Log in to your dashboard to claim your dividend before the deadline.`,
            type:        'SYSTEM',
            category:    'DIVIDEND',
          }).catch(() => {});
        }
      } catch {}

      res.json({
        success: true,
        roundId: result.insertId,
        claimDeadline,
        message: `Distribution round created. ${amountPerToken} USD per token. Investors can claim until ${claimDeadline.toLocaleDateString()}.`
      });
    } catch (err) {
      await conn.rollback();
      logger.error('Dividend creation failed', { error: err.message });
      res.status(500).json({ error: 'Failed to create dividend round: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── GET /api/dividends/claimable — get claimable dividends for current user
router.get('/claimable', authenticate, async (req, res) => {
  try {
    // Get investor's wallet address
    const [userRows] = await db.execute(
      'SELECT wallet_address FROM users WHERE id = ?', [req.user.userId]
    );
    if (userRows.length === 0) return res.json([]);
    const walletAddress = userRows[0].wallet_address;

    const [rows] = await db.execute(`
      SELECT dr.id, dr.token_symbol, dr.round_type, dr.description,
             dr.total_amount_usdc, dr.amount_per_token,
             dr.claim_deadline, dr.status,
             COALESCE(th.balance, 0) AS token_balance
      FROM dividend_rounds dr
      LEFT JOIN tokens t ON t.symbol = dr.token_symbol OR t.token_symbol = dr.token_symbol
      LEFT JOIN token_holdings th ON th.token_id = t.id AND th.user_id = ?
      WHERE dr.status = 'OPEN'
      AND dr.claim_deadline > NOW()
      AND dr.id NOT IN (
        SELECT round_id FROM dividend_claims
        WHERE wallet_address = ? AND claimed = TRUE
      )
      ORDER BY dr.created_at DESC
    `, [req.user.userId, walletAddress]);

    // Enrich with estimated payout for this investor
    const whtRate = await getWithholdingRate(db, req.user.userId);
    const enriched = rows.map(r => {
      const gross      = parseFloat(r.token_balance) * parseFloat(r.amount_per_token);
      const withholding = parseFloat((gross * whtRate).toFixed(6));
      const net         = parseFloat((gross - withholding).toFixed(6));
      return {
        ...r,
        estimated_gross:      gross.toFixed(6),
        estimated_withholding: withholding.toFixed(6),
        estimated_net:         net.toFixed(6),
        withholding_rate:      whtRate,
      };
    });

    res.json(enriched.filter(r => parseFloat(r.token_balance) > 0));
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch dividends: ' + err.message });
  }
});

// ── POST /api/dividends/claim — investor claims a dividend with WHT deducted
router.post('/claim', authenticate, requireKYC, async (req, res) => {
  const { roundId } = req.body;
  if (!roundId) return res.status(400).json({ error: 'roundId is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Load round
    const [rounds] = await conn.execute(
      'SELECT * FROM dividend_rounds WHERE id = ?', [roundId]
    );
    if (rounds.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Round not found' });
    }
    const round = rounds[0];

    if (round.status !== 'OPEN') {
      await conn.rollback();
      return res.status(400).json({ error: 'This distribution round is not open' });
    }
    if (new Date() > new Date(round.claim_deadline)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Claim window has closed' });
    }

    // Get investor wallet address
    const [userRows] = await conn.execute(
      'SELECT wallet_address, email, full_name FROM users WHERE id = ?', [req.user.userId]
    );
    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }
    const walletAddress = userRows[0].wallet_address;

    // Check not already claimed
    const [existing] = await conn.execute(
      'SELECT id FROM dividend_claims WHERE round_id = ? AND wallet_address = ? AND claimed = TRUE',
      [roundId, walletAddress]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'You have already claimed this distribution' });
    }

    // Get investor token holdings
    const [tokens] = await conn.execute(
      'SELECT id FROM tokens WHERE symbol = ? OR token_symbol = ?',
      [round.token_symbol, round.token_symbol]
    );
    if (tokens.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Token not found' });
    }

    const [holdings] = await conn.execute(
      'SELECT balance FROM token_holdings WHERE user_id = ? AND token_id = ?',
      [req.user.userId, tokens[0].id]
    );

    const tokenBalance = holdings.length > 0 ? parseFloat(holdings[0].balance) : 0;
    if (tokenBalance <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'You have no token holdings for this distribution' });
    }

    // Calculate gross payout
    const grossAmount = parseFloat((tokenBalance * parseFloat(round.amount_per_token)).toFixed(6));
    if (grossAmount <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Calculated payout is zero' });
    }

    // Determine withholding rate from KYC country
    const whtRate     = await getWithholdingRate(conn, req.user.userId);
    const withholding = parseFloat((grossAmount * whtRate).toFixed(6));
    const netAmount   = parseFloat((grossAmount - withholding).toFixed(6));

    // Load investor wallet
    const [wallets] = await conn.execute(
      'SELECT * FROM investor_wallets WHERE user_id = ?', [req.user.userId]
    );

    let currentBal = 0;
    if (wallets.length === 0) {
      // Create wallet if missing
      await conn.execute(
        'INSERT INTO investor_wallets (id, user_id, balance_usd, balance_usdc, reserved_usd) VALUES (gen_random_uuid(), ?, 0, 0, 0)',
        [req.user.userId]
      );
    } else {
      currentBal = parseFloat(wallets[0].balance_usd);
    }

    const newBal = parseFloat((currentBal + netAmount).toFixed(2));

    // Credit investor wallet with net amount
    await conn.execute(
      'UPDATE investor_wallets SET balance_usd = ?, updated_at = NOW() WHERE user_id = ?',
      [newBal, req.user.userId]
    );

    // Wallet transaction for investor
    await conn.execute(`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
      VALUES (gen_random_uuid(), ?, 'DIVIDEND', ?, ?, ?, ?, ?)
    `, [
      req.user.userId,
      netAmount, currentBal, newBal,
      String(roundId),
      `${round.round_type} — ${round.token_symbol}. Gross: $${grossAmount.toFixed(4)}, WHT (${(whtRate*100).toFixed(0)}%): -$${withholding.toFixed(4)}, Net: $${netAmount.toFixed(4)}`
    ]);

    // Credit platform treasury with withholding tax (held for ZIMRA)
    if (withholding > 0) {
      await conn.execute(
        'UPDATE platform_treasury SET usd_liability = usd_liability + ?, updated_at = NOW() WHERE id = 1',
        [withholding]
      );
    }

    // Upsert monthly WHT batch (banking partner remits to ZIMRA monthly)
    if (withholding > 0) {
      const [batchRows] = await conn.execute(`
        SELECT id FROM wht_batches
        WHERE status = 'OPEN'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
        AND wht_type = 'DIVIDEND'
        LIMIT 1
      `);
      if (batchRows.length > 0) {
        await conn.execute(`
          UPDATE wht_batches
          SET total_amount_usd    = total_amount_usd    + ?,
              transaction_count   = transaction_count   + 1,
              resident_amount     = resident_amount     + ?,
              non_resident_amount = non_resident_amount + ?
          WHERE id = ?
        `, [
          withholding,
          whtRate <= 0.10 ? withholding : 0,
          whtRate >  0.10 ? withholding : 0,
          batchRows[0].id,
        ]);
      } else {
        const periodLabel = new Date().toISOString().slice(0, 7); // YYYY-MM
        await conn.execute(`
          INSERT INTO wht_batches
            (id, period, wht_type, total_amount_usd,
             resident_amount, non_resident_amount,
             transaction_count, status)
          VALUES (gen_random_uuid(), ?, 'DIVIDEND', ?, ?, ?, 1, 'OPEN')
        `, [
          periodLabel, withholding,
          whtRate <= 0.10 ? withholding : 0,
          whtRate >  0.10 ? withholding : 0,
        ]);
      }
    }

    // Insert claim record
    await conn.execute(`
      INSERT INTO dividend_claims
        (round_id, user_id, wallet_address, token_symbol, amount_usdc,
         gross_amount, withholding_rate, withholding_tax, net_amount,
         token_balance_at_snapshot, claimed, claimed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `, [
      roundId, req.user.userId, walletAddress,
      round.token_symbol, netAmount,
      grossAmount, whtRate, withholding, netAmount,
      tokenBalance
    ]);

    // Update round totals
    await conn.execute(`
      UPDATE dividend_rounds
      SET total_distributed = total_distributed + ?,
          total_withheld    = total_withheld    + ?,
          investors_paid    = investors_paid    + 1,
          updated_at        = NOW()
      WHERE id = ?
    `, [netAmount, withholding, roundId]);

    await conn.commit();

    await sendMessage({
      recipientId: req.user.userId,
      subject:     `✅ Distribution Received — $${netAmount.toFixed(2)} USD — ${round.token_symbol}`,
      body:        `You have received a distribution of $${grossAmount.toFixed(2)} for your ${round.token_symbol} holding. Net amount after WHT (${(whtRate*100).toFixed(0)}%): $${netAmount.toFixed(2)} USD credited to your wallet.`,
      type:        'SYSTEM',
      category:    'DIVIDEND',
    }).catch(() => {});

    if (userRows[0]?.email) {
      const { notifyInvestorDistributionReceived } = require('../utils/mailer');
      notifyInvestorDistributionReceived({
        investorEmail:   userRows[0].email,
        investorName:    userRows[0].full_name || 'Investor',
        tokenSymbol:     round.token_symbol,
        grossAmount,
        withholdingRate: whtRate,
        withholdingTax:  withholding,
        netAmount,
        tokenBalance,
        distributionDate: new Date(),
      }).catch(e => console.error('[MAILER] notifyInvestorDistributionReceived failed:', e.message));
    }

    logger.info('Dividend claimed', {
      userId: req.user.userId, roundId,
      grossAmount, withholding, netAmount, whtRate
    });

    res.json({
      success:        true,
      grossAmount:    grossAmount.toFixed(4),
      withholdingTax: withholding.toFixed(4),
      withholdingRate: `${(whtRate * 100).toFixed(0)}%`,
      netAmount:      netAmount.toFixed(4),
      newBalance:     newBal.toFixed(2),
      message: `$${netAmount.toFixed(4)} credited to your wallet after ${(whtRate*100).toFixed(0)}% withholding tax of $${withholding.toFixed(4)}.`
    });

  } catch (err) {
    await conn.rollback();
    logger.error('Dividend claim failed', { error: err.message });
    res.status(500).json({ error: 'Failed to claim dividend: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── GET /api/dividends/rounds/:tokenSymbol — all rounds for a token
router.get('/rounds/:tokenSymbol', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT dr.*, dr.total_distributed, dr.total_withheld, dr.investors_paid
      FROM dividend_rounds dr
      WHERE dr.token_symbol = ?
      ORDER BY dr.created_at DESC
    `, [req.params.tokenSymbol.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch rounds' });
  }
});

// ── GET /api/dividends/rounds — all rounds (dashboard alias)
router.get('/rounds', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT dr.*, dr.total_distributed, dr.total_withheld, dr.investors_paid
      FROM dividend_rounds dr
      ORDER BY dr.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch rounds' });
  }
});

// ── GET /api/dividends/claimable/:walletAddress — dashboard alias
router.get('/claimable/:walletAddress', authenticate, async (req, res) => {
  const isAdmin = req.user.role === 'ADMIN';
  const isOwnRequest = req.params.walletAddress === req.user.userId ||
                       req.params.walletAddress === req.user.wallet;
  if (!isAdmin && !isOwnRequest) return res.status(403).json({ error: 'Access denied' });
  try {
    const [userRows] = await db.execute(
      'SELECT id FROM users WHERE wallet_address = ? OR id = ?',
      [req.params.walletAddress.toLowerCase(), req.params.walletAddress]
    );
    if (userRows.length === 0) return res.json([]);
    const userId = userRows[0].id;

    const [rows] = await db.execute(`
      SELECT dr.id, dr.token_symbol, dr.round_type, dr.description,
             dr.total_amount_usdc, dr.amount_per_token,
             dr.claim_deadline, dr.status,
             COALESCE(th.balance, 0) AS token_balance
      FROM dividend_rounds dr
      LEFT JOIN tokens t ON t.symbol = dr.token_symbol OR t.token_symbol = dr.token_symbol
      LEFT JOIN token_holdings th ON th.token_id = t.id AND th.user_id = ?
      WHERE dr.status = 'OPEN'
      AND dr.claim_deadline > NOW()
      AND dr.id NOT IN (
        SELECT round_id FROM dividend_claims
        WHERE wallet_address = ? AND claimed = TRUE
      )
      ORDER BY dr.created_at DESC
    `, [userId, req.params.walletAddress.toLowerCase()]);

    const whtRate   = await getWithholdingRate(db, userId);
    const enriched  = rows
      .filter(r => parseFloat(r.token_balance) > 0)
      .map(r => {
        const gross      = parseFloat(r.token_balance) * parseFloat(r.amount_per_token);
        const withholding = parseFloat((gross * whtRate).toFixed(6));
        const net         = parseFloat((gross - withholding).toFixed(6));
        return { ...r, estimated_gross: gross.toFixed(6), estimated_withholding: withholding.toFixed(6), estimated_net: net.toFixed(6), withholding_rate: whtRate };
      });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch dividends' });
  }
});

// ── GET /api/dividends/history — investor's claim history
router.get('/history', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT dc.*, dr.round_type, dr.description, dr.claim_deadline
      FROM dividend_claims dc
      JOIN dividend_rounds dr ON dr.id = dc.round_id
      WHERE dc.user_id = ?
      ORDER BY dc.claimed_at DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

// ── GET /api/dividends/wht-certificate — investor's annual WHT tax certificate
router.get('/wht-certificate', authenticate, async (req, res) => {
  try {
    const taxYear = parseInt(req.query.year, 10) || new Date().getFullYear();
    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd   = new Date(taxYear, 11, 31, 23, 59, 59);

    const [userRows] = await db.execute(
      'SELECT full_name, email FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });
    const investor = userRows[0];

    const [rows] = await db.execute(`
      SELECT
        dc.token_symbol,
        dr.round_type,
        dc.gross_amount,
        dc.withholding_rate,
        dc.withholding_tax,
        dc.net_amount,
        dc.claimed_at
      FROM dividend_claims dc
      JOIN dividend_rounds dr ON dr.id = dc.round_id
      WHERE dc.user_id = ?
        AND dc.claimed = TRUE
        AND dc.claimed_at BETWEEN ? AND ?
      ORDER BY dc.token_symbol, dc.claimed_at
    `, [req.user.userId, yearStart, yearEnd]);

    const byToken = rows.reduce((acc, r) => {
      const k = r.token_symbol;
      if (!acc[k]) acc[k] = { token_symbol: k, distribution_count: 0, gross_amount: 0, withholding_tax: 0, net_amount: 0, wht_rate: r.withholding_rate };
      acc[k].distribution_count++;
      acc[k].gross_amount    += parseFloat(r.gross_amount    || 0);
      acc[k].withholding_tax += parseFloat(r.withholding_tax || 0);
      acc[k].net_amount      += parseFloat(r.net_amount      || 0);
      return acc;
    }, {});

    const whtSummary = Object.values(byToken).map(t => ({
      token_symbol:       t.token_symbol,
      distribution_count: t.distribution_count,
      gross_amount:       t.gross_amount.toFixed(2),
      wht_rate:           `${(parseFloat(t.wht_rate) * 100).toFixed(0)}%`,
      withholding_tax:    t.withholding_tax.toFixed(2),
      net_amount:         t.net_amount.toFixed(2),
    }));

    const totals = rows.reduce((acc, r) => {
      acc.gross_amount    += parseFloat(r.gross_amount    || 0);
      acc.withholding_tax += parseFloat(r.withholding_tax || 0);
      acc.net_amount      += parseFloat(r.net_amount      || 0);
      return acc;
    }, { gross_amount: 0, withholding_tax: 0, net_amount: 0 });

    res.json({
      investor_name:    investor.full_name,
      investor_email:   investor.email,
      tax_year:         taxYear,
      platform:         'TokenEquityX (Private) Limited',
      certificate_date: new Date().toISOString().split('T')[0],
      wht_summary:      whtSummary,
      totals: {
        gross_amount:    totals.gross_amount.toFixed(2),
        withholding_tax: totals.withholding_tax.toFixed(2),
        net_amount:      totals.net_amount.toFixed(2),
      },
      regulatory_note: 'This certificate summarises withholding tax deducted at source on distributions paid to you, in terms of the Income Tax Act [Chapter 23:06]. Withholding tax has been remitted to the Zimbabwe Revenue Authority (ZIMRA) on your behalf. Retain this certificate for your personal tax records.',
    });
  } catch (err) {
    logger.error('WHT certificate generation failed', { error: err.message });
    res.status(500).json({ error: 'Could not generate WHT certificate' });
  }
});

// ── GET /api/dividends/admin/summary — admin withholding tax summary for ZIMRA
router.get('/admin/summary',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT
          dr.token_symbol,
          dr.round_type,
          dr.id AS round_id,
          dr.created_at,
          dr.total_distributed,
          dr.total_withheld,
          dr.investors_paid,
          SUM(CASE WHEN dc.withholding_rate = 0.10 THEN dc.withholding_tax ELSE 0 END) AS resident_wht,
          SUM(CASE WHEN dc.withholding_rate = 0.15 THEN dc.withholding_tax ELSE 0 END) AS non_resident_wht,
          COUNT(dc.id) AS total_claims
        FROM dividend_rounds dr
        LEFT JOIN dividend_claims dc ON dc.round_id = dr.id AND dc.claimed = 1
        GROUP BY dr.id
        ORDER BY dr.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch summary' });
    }
  }
);

module.exports = router;
