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
const { sendMessage }               = require('../utils/messenger');
const { getNumericSetting }         = require('../utils/platformSettings');
const { createSettlementInstruction } = require('../utils/settlement');

const ISSUANCE_FEE_RATE = 0.02; // 2% — fallback if platform_fee_rate not set

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
      offering_rationale,
      retail_min_usd, institutional_min_usd,
      anchor_phase_end_date, allow_retail_ipo, risk_warning_required,
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

      // Guard: submission must have cleared the approval pipeline before an offering can be created
      const [submissionRows] = await conn.execute(
        `SELECT status FROM data_submissions
         WHERE token_symbol = ? AND submission_type = 'TOKENISATION_APPLICATION'
         ORDER BY created_at DESC LIMIT 1`,
        [token.token_symbol || token.symbol]
      );
      if (submissionRows.length === 0) {
        await conn.rollback();
        return res.status(403).json({ error: 'No tokenisation application found for this token.' });
      }
      const submissionStatus = submissionRows[0].status;
      const OFFERING_ALLOWED_STATUSES = ['TOKENIZATION_PENDING', 'SECZ_APPROVED', 'LIVE'];
      if (!OFFERING_ALLOWED_STATUSES.includes(submissionStatus)) {
        await conn.rollback();
        return res.status(403).json({
          error: `Token has not completed the approval pipeline. Current status: ${submissionStatus}. Offering creation requires admin committee approval (TOKENIZATION_PENDING).`
        });
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
          retail_min_usd, institutional_min_usd,
          anchor_phase_end_date, allow_retail_ipo, risk_warning_required,
          total_tokens_offered, issuance_fee_rate,
          subscription_deadline, offering_rationale, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
      `, [
        token_id,
        req.user.userId,
        offering_price_usd, target_raise_usd,
        min_subscription_usd || 100,
        max_subscription_usd || null,
        retail_min_usd || 100,
        institutional_min_usd || 10000,
        anchor_phase_end_date ? new Date(anchor_phase_end_date) : null,
        allow_retail_ipo !== false,
        risk_warning_required !== false,
        total_tokens_offered,
        ISSUANCE_FEE_RATE,
        new Date(subscription_deadline),
        offering_rationale || null,
      ]);

      await conn.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_PROPOSED', ?, ?, ?)`,
        [req.user.userId, `token:${token_id}`,
         `Offering proposed for ${token.symbol}. Price: $${offering_price_usd}. Target: $${target_raise_usd}`]
      );

      await conn.commit();

      // FIX 2.1 — notify issuer and admin that a new offering has been proposed
      try {
        const { notifyIssuerOfferingProposed } = require('../utils/mailer');
        const offeringSym = token.token_symbol || token.symbol;
        const offeringId  = result.insertId;

        sendMessage({
          recipientId: req.user.userId,
          subject:     `📊 Offering Proposed — ${offeringSym}`,
          body:        `Your primary offering proposal for ${offeringSym} has been submitted and is now awaiting auditor review and admin approval.\n\nOffering Price: $${parseFloat(offering_price_usd).toFixed(2)}\nTarget Raise: $${parseFloat(target_raise_usd).toFixed(2)}\nTokens Offered: ${parseInt(total_tokens_offered).toLocaleString()}\n\nYou will be notified once reviewed.`,
          type: 'SYSTEM', category: 'OFFERING', referenceId: String(offeringId),
        }).catch(e => console.error('[MESSENGER] offerings POST sendMessage (issuer) failed:', e.message));

        const [ofpAdminRows] = await db.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
        if (ofpAdminRows.length > 0) {
          sendMessage({
            recipientId: ofpAdminRows[0].id,
            subject:     `🆕 New Offering Proposed — ${offeringSym}`,
            body:        `A new primary offering has been proposed for ${offeringSym}.\n\nOffering Price: $${parseFloat(offering_price_usd).toFixed(2)}\nTarget Raise: $${parseFloat(target_raise_usd).toFixed(2)}\nTokens Offered: ${parseInt(total_tokens_offered).toLocaleString()}\n\nPlease review via the Offerings tab in the admin dashboard.`,
            type: 'SYSTEM', category: 'OFFERING', referenceId: String(offeringId),
          }).catch(e => console.error('[MESSENGER] offerings POST sendMessage (admin) failed:', e.message));
        }

        const [ofpIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [req.user.userId]);
        if (ofpIssuerRows[0]?.email) {
          notifyIssuerOfferingProposed({
            issuerEmail:    ofpIssuerRows[0].email,
            issuerName:     ofpIssuerRows[0].full_name,
            tokenSymbol:    offeringSym,
            offeringPrice:  offering_price_usd,
            targetRaise:    target_raise_usd,
            tokensOffered:  total_tokens_offered,
            submittedAt:    new Date(),
          }).catch(e => console.error('[MAILER] offerings POST notifyIssuerOfferingProposed failed:', e.message));
        }
      } catch (notifyErr) {
        console.error('[OFFERING-PROPOSE] Notification error (non-fatal):', notifyErr.message);
      }

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

      // FIX 1.4 — notify issuer that offering is now open
      try {
        const [approveTokenRows] = await db.execute('SELECT token_symbol FROM tokens WHERE id = ?', [offering.token_id]);
        const approveTokenSym = approveTokenRows[0]?.token_symbol || 'your token';
        await sendMessage({
          recipientId: offering.issuer_id,
          subject:     `✅ Offering Approved — Now Open — ${approveTokenSym}`,
          body:        `Your primary offering for ${approveTokenSym} has been approved and is now OPEN to investors. Subscription deadline: ${new Date(offering.subscription_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
        }).catch(() => {});
        const { notifyIssuerOfferingApproved } = require('../utils/mailer');
        const [oapIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [offering.issuer_id]);
        if (oapIssuerRows[0]?.email) {
          notifyIssuerOfferingApproved({
            issuerEmail:  oapIssuerRows[0].email,
            issuerName:   oapIssuerRows[0].full_name,
            tokenSymbol:  approveTokenSym,
            offeringPrice: offering.offering_price_usd,
            targetRaise:  offering.target_raise_usd,
            deadline:     offering.subscription_deadline,
          }).catch(e => console.error('[MAILER] offering-approve notifyIssuerOfferingApproved failed:', e.message));
        }
        // If offering has anchor_phase_end_date, notify institutional investors
        if (offering.anchor_phase_end_date) {
          try {
            const { notifyAnchorPhaseOpen } = require('../utils/mailer');
            const [instRows] = await db.execute(`
              SELECT u.email, u.full_name
              FROM users u
              JOIN kyc_records kr ON kr.user_id = u.id
              WHERE kr.investor_tier = 'INSTITUTIONAL'
                AND kr.status = 'APPROVED'
                AND u.role = 'INVESTOR'
            `);
            instRows.forEach(inv => {
              notifyAnchorPhaseOpen({
                institutionEmail:   inv.email,
                institutionName:    inv.full_name,
                tokenName:          approveTokenSym,
                tokenSymbol:        approveTokenSym,
                assetType:          offering.asset_type,
                priceUsd:           offering.offering_price_usd,
                institutionalMinUsd: offering.institutional_min_usd,
                anchorPhaseEndDate: offering.anchor_phase_end_date,
                offeringId:         req.params.id,
              }).catch(e => console.error('[MAILER] notifyAnchorPhaseOpen failed:', e.message));
            });
          } catch (anchorErr) {
            console.error('[OFFERING-APPROVE] Anchor phase notification error (non-fatal):', anchorErr.message);
          }
        }
      } catch (notifyErr) {
        console.error('[OFFERING-APPROVE] Notification error (non-fatal):', notifyErr.message);
      }

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

      // FIX 1.5 — notify issuer of rejection
      try {
        const offering = rows[0];
        const [rejectTokenRows] = await db.execute('SELECT token_symbol FROM tokens WHERE id = ?', [offering.token_id]);
        const rejectTokenSym = rejectTokenRows[0]?.token_symbol || 'your token';
        await sendMessage({
          recipientId: offering.issuer_id,
          subject:     `❌ Offering Proposal Rejected — ${rejectTokenSym}`,
          body:        `Your primary offering proposal for ${rejectTokenSym} has been rejected. Reason: ${reason || 'Not specified'}. Please review and resubmit.`,
          type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
        }).catch(() => {});
        const { notifyIssuerOfferingRejected } = require('../utils/mailer');
        const [orpIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [offering.issuer_id]);
        if (orpIssuerRows[0]?.email) {
          notifyIssuerOfferingRejected({
            issuerEmail: orpIssuerRows[0].email,
            issuerName:  orpIssuerRows[0].full_name,
            tokenSymbol: rejectTokenSym,
            reason,
          }).catch(e => console.error('[MAILER] offering-reject notifyIssuerOfferingRejected failed:', e.message));
        }
      } catch (notifyErr) {
        console.error('[OFFERING-REJECT] Notification error (non-fatal):', notifyErr.message);
      }

      res.json({ success: true, message: 'Offering rejected.' });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject offering: ' + err.message });
    }
  }
);

// ── checkSubscriptionEligibility — tier-aware eligibility helper ──────────────
async function checkSubscriptionEligibility(investor, offering, amountUsd) {
  const errors = [];
  const tier = investor.investor_tier || 'RETAIL';

  if (offering.status !== 'OPEN') {
    errors.push('This offering is not currently open for subscriptions.');
  }
  if (new Date() > new Date(offering.subscription_deadline)) {
    errors.push('The subscription deadline for this offering has passed.');
  }
  if (tier === 'RETAIL' && offering.allow_retail_ipo === false) {
    errors.push('This offering is restricted to institutional and corporate investors.');
  }
  if (offering.anchor_phase_end_date) {
    const anchorEnd = new Date(offering.anchor_phase_end_date);
    if (new Date() < anchorEnd && tier === 'RETAIL') {
      errors.push(
        `This offering is currently in the institutional anchor phase. ` +
        `Public subscription opens on ${anchorEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.`
      );
    }
  }

  let minimumUsd;
  if (tier === 'INSTITUTIONAL') {
    minimumUsd = parseFloat(offering.institutional_min_usd || offering.min_subscription_usd || 10000);
  } else if (tier === 'CORPORATE') {
    minimumUsd = parseFloat(offering.min_subscription_usd || 500);
  } else {
    minimumUsd = parseFloat(offering.retail_min_usd || offering.min_subscription_usd || 100);
  }
  if (amountUsd < minimumUsd) {
    errors.push(`Minimum subscription for ${tier.toLowerCase()} investors is USD ${minimumUsd.toLocaleString()}.`);
  }
  if (offering.max_subscription_usd && amountUsd > parseFloat(offering.max_subscription_usd)) {
    errors.push(`Maximum subscription per investor is USD ${parseFloat(offering.max_subscription_usd).toLocaleString()}.`);
  }

  return { errors, tier, minimumUsd };
}

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

      // KYC gate — investor must be approved + fetch tier
      const [investorRows] = await conn.execute(
        `SELECT u.kyc_status, k.investor_tier
         FROM users u
         LEFT JOIN kyc_records k ON k.user_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [req.user.userId]
      );
      if (!investorRows.length || investorRows[0].kyc_status !== 'APPROVED') {
        await conn.rollback();
        return res.status(403).json({
          error: 'Your KYC verification must be approved before you can subscribe to offerings. Please complete your KYC and wait for admin approval.',
        });
      }
      const investor = investorRows[0];

      const subscribeAmount = parseFloat(amount_usd);

      // Tier-aware eligibility check
      const { errors, tier } = await checkSubscriptionEligibility(investor, offering, subscribeAmount);
      if (errors.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Subscription not eligible', reasons: errors });
      }

      // Risk acknowledgement gate for retail investors on primary offerings
      if (tier === 'RETAIL' && offering.risk_warning_required !== false) {
        const [ackRows] = await conn.execute(
          `SELECT id FROM risk_acknowledgements
           WHERE investor_id = ? AND token_symbol = (
             SELECT COALESCE(token_symbol, symbol) FROM tokens WHERE id = ?
           ) LIMIT 1`,
          [req.user.userId, offering.token_id]
        );
        if (ackRows.length === 0) {
          await conn.rollback();
          const [tokenRows] = await db.execute(
            'SELECT COALESCE(token_symbol, symbol) AS symbol FROM tokens WHERE id = ?', [offering.token_id]
          );
          return res.status(402).json({
            requires_risk_acknowledgement: true,
            token_symbol: tokenRows[0]?.symbol || '',
            risk_warning: 'Primary market investments in tokenised securities are illiquid and carry risk of partial or total loss. Returns are not guaranteed. This investment is not covered by any deposit protection scheme. By proceeding, you confirm you understand and accept these risks.',
            action: `POST /api/offerings/${req.params.id}/acknowledge-risk`,
          });
        }
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

      const reservedBefore = parseFloat(wallet.reserved_usd || 0);

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

      const [subResult] = await conn.execute(`
        INSERT INTO offering_subscriptions
          (offering_id, investor_id, amount_usd, tokens_allocated, settlement_rail, status, investor_tier)
        VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?)
      `, [req.params.id, req.user.userId, subscribeAmount, tokensAllocated, rail, tier]);
      const subscriptionId = subResult.insertId;

      await conn.execute(`
        UPDATE primary_offerings
        SET tokens_subscribed = tokens_subscribed + ?,
            total_raised_usd  = total_raised_usd  + ?,
            updated_at = NOW()
        WHERE id = ?
      `, [tokensAllocated, subscribeAmount, req.params.id]);

      // F-12: type = SUBSCRIPTION_RESERVE; balance_before/after = reserved_usd for FIAT
      await conn.execute(`
        INSERT INTO wallet_transactions
          (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
        VALUES (gen_random_uuid(), ?, 'SUBSCRIPTION_RESERVE', ?, ?, ?, ?, ?)
      `, [
        req.user.userId, -subscribeAmount,
        rail === 'USDC' ? availableBalance           : reservedBefore,
        rail === 'USDC' ? availableBalance - subscribeAmount : reservedBefore + subscribeAmount,
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

      // FIX 1.6 — confirm subscription to the investor
      try {
        const [subTokenRows] = await db.execute('SELECT token_symbol FROM tokens WHERE id = ?', [offering.token_id]);
        const subTokenSym = subTokenRows[0]?.token_symbol || 'the offering';
        await sendMessage({
          recipientId: req.user.userId,
          subject:     `✅ Subscription Confirmed — ${subTokenSym}`,
          body:        `Your subscription has been confirmed. Amount: $${subscribeAmount.toFixed(2)}. Tokens reserved: ${tokensAllocated}. You will receive your tokens once the offering closes.`,
          type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
        }).catch(() => {});
        const { notifySubscriptionConfirmedPrimary } = require('../utils/mailer');
        const [subInvRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [req.user.userId]);
        if (subInvRows[0]?.email) {
          const issuanceFeeUsd = subscribeAmount * parseFloat(offering.issuance_fee_rate || 0.02);
          notifySubscriptionConfirmedPrimary({
            investorEmail:    subInvRows[0].email,
            investorName:     subInvRows[0].full_name,
            tokenName:        offering.token_name || subTokenSym,
            tokenSymbol:      subTokenSym,
            quantity:         tokensAllocated,
            pricePerToken:    offering.offering_price_usd,
            amountUsd:        subscribeAmount,
            issuanceFeeUsd,
            deadline:         offering.subscription_deadline,
          }).catch(e => console.error('[MAILER] subscribe notifySubscriptionConfirmedPrimary failed:', e.message));
        }
      } catch (notifyErr) {
        console.error('[SUBSCRIBE] Investor notification error (non-fatal):', notifyErr.message);
      }

      res.json({
        success: true,
        subscription_id: subscriptionId,
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

// ── POST /api/offerings/:id/acknowledge-risk — retail investor acknowledges risk
// Records acknowledgement in risk_acknowledgements. Required before subscribing
// to any primary offering where risk_warning_required = TRUE.
router.post('/:id/acknowledge-risk',
  authenticate,
  async (req, res) => {
    try {
      const [offerings] = await db.execute(
        'SELECT po.token_id, t.token_symbol, t.symbol FROM primary_offerings po JOIN tokens t ON t.id = po.token_id WHERE po.id = ?',
        [req.params.id]
      );
      if (offerings.length === 0) return res.status(404).json({ error: 'Offering not found' });
      const tokenSymbol = offerings[0].token_symbol || offerings[0].symbol;

      const [kycRows] = await db.execute(
        'SELECT investor_tier FROM kyc_records WHERE user_id = ? LIMIT 1', [req.user.userId]
      );
      const tier = kycRows[0]?.investor_tier || 'RETAIL';

      await db.execute(
        `INSERT INTO risk_acknowledgements (investor_id, token_symbol, investor_profile, token_category)
         VALUES (?, ?, ?, 'PRIMARY_OFFERING')
         ON CONFLICT (investor_id, token_symbol) DO UPDATE SET acknowledged_at = NOW()`,
        [req.user.userId, tokenSymbol, tier]
      );

      res.json({ acknowledged: true, token_symbol: tokenSymbol });
    } catch (err) {
      res.status(500).json({ error: 'Could not record acknowledgement: ' + err.message });
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
      const vatRate     = await getNumericSetting('vat_rate', 0.155);
      const feeRate     = parseFloat(offering.issuance_fee_rate) || await getNumericSetting('platform_fee_rate', 0.005);
      const issuanceFee      = parseFloat((totalRaised * feeRate).toFixed(2));
      const vatOnIssuanceFee = parseFloat((issuanceFee * vatRate).toFixed(2));
      const netProceeds      = parseFloat((totalRaised - issuanceFee - vatOnIssuanceFee).toFixed(2));

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
            const balBefore = parseFloat(iw[0].balance_usd);
            const newBal    = parseFloat((balBefore - parseFloat(sub.amount_usd)).toFixed(2));
            const newRes    = parseFloat(Math.max(0, parseFloat(iw[0].reserved_usd) - parseFloat(sub.amount_usd)).toFixed(2));
            await conn.execute(
              'UPDATE investor_wallets SET balance_usd = ?, reserved_usd = ?, updated_at = NOW() WHERE user_id = ?',
              [newBal, newRes, sub.investor_id]
            );
            // F-13: ledger entry for the debit at close
            await conn.execute(`
              INSERT INTO wallet_transactions
                (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (gen_random_uuid(), ?, 'SUBSCRIPTION_DEBIT', ?, ?, ?, ?, ?)
            `, [
              sub.investor_id,
              -parseFloat(sub.amount_usd),
              balBefore, newBal,
              null,
              `Primary offering debit — ${sub.tokens_allocated} ${token.token_symbol || token.symbol} tokens`,
            ]);
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
          `Primary offering proceeds — ${tokenSym}. Gross: $${totalRaised.toFixed(2)}, Fee: $${issuanceFee.toFixed(2)}, VAT: $${vatOnIssuanceFee.toFixed(2)}, Net: $${netProceeds.toFixed(2)}`
        ]);
      }

      const tokenSym = token.token_symbol || token.symbol;

      // Credit platform treasury (issuance fee + VAT)
      await conn.execute(
        'UPDATE platform_treasury SET usd_liability = usd_liability + ?, updated_at = NOW() WHERE id = 1',
        [parseFloat((issuanceFee + vatOnIssuanceFee).toFixed(2))]
      );

      // F-02: Queue disbursement for banking partner to process EFT to issuer
      await conn.execute(`
        INSERT INTO disbursement_queue
          (id, token_symbol, issuer_id, entity_name,
           gross_amount, platform_fee, secz_levy, vat_on_fees,
           net_amount, status, reference)
        VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, 0, ?, ?, 'PENDING', ?)
      `, [
        tokenSym,
        offering.issuer_id,
        token.company_name || token.token_name || token.name || null,
        totalRaised.toFixed(6),
        issuanceFee.toFixed(6),
        vatOnIssuanceFee.toFixed(6),
        netProceeds.toFixed(6),
        `DISB-${tokenSym.toUpperCase()}-${Date.now()}`,
      ]);

      // F-03: Create settlement instruction for banking partner dashboard
      await createSettlementInstruction(conn, {
        type:            'OFFERING_CLOSE',
        token_symbol:    tokenSym,
        from_user_id:    null,
        to_user_id:      offering.issuer_id,
        gross_amount:    totalRaised,
        fee_amount:      issuanceFee + vatOnIssuanceFee,
        net_amount:      netProceeds,
        settlement_rail: 'FIAT',
        reference:       `SETTLE-${tokenSym.toUpperCase()}-${Date.now()}`,
      });

      // Determine post-offering trading mode from the token's listing_type
      const newTradingMode = token.listing_type === 'BROWNFIELD_BOURSE' ? 'FULL_TRADING' : 'P2P_ONLY';

      await conn.execute(`
        UPDATE primary_offerings SET
          status = 'DISBURSED', issuance_fee_usd = ?, net_proceeds_usd = ?,
          closed_at = NOW(), disbursed_at = NOW(), disbursed_by = ?,
          bank_reference = ?, admin_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [issuanceFee, netProceeds, req.user.userId, bank_reference || null, admin_notes || null, req.params.id]);

      await conn.execute(
        'UPDATE tokens SET market_state = ?, trading_mode = ?, updated_at = NOW() WHERE id = ?',
        [newTradingMode, newTradingMode, offering.token_id]
      );

      await conn.execute(
        `INSERT INTO audit_logs (action, performed_by, target_entity, details)
         VALUES ('OFFERING_CLOSED_DISBURSED', ?, ?, ?)`,
        [req.user.userId, `offering:${offering.id}`,
         `Closed. Raised: $${totalRaised}, Fee: $${issuanceFee}, VAT: $${vatOnIssuanceFee}, Net to issuer: $${netProceeds}. ${subscriptions.length} investors. Token → ${newTradingMode}`]
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

      // FIX 2.2 — notify each investor that the offering closed and their tokens are credited
      try {
        const { notifyInvestorOfferingClosed } = require('../utils/mailer');
        const closedSym = token.token_symbol || token.symbol;
        for (const sub of subscriptions) {
          sendMessage({
            recipientId: sub.investor_id,
            subject:     `🎉 Offering Closed — ${closedSym} Tokens Credited`,
            body:        `The ${closedSym} primary offering has closed. Your ${parseInt(sub.tokens_allocated).toLocaleString()} tokens have been credited to your portfolio and are now available for secondary market trading.\n\nTokens Received: ${parseInt(sub.tokens_allocated).toLocaleString()}\nTotal Investment: $${parseFloat(sub.amount_usd).toFixed(2)} USD`,
            type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
          }).catch(() => {});
          const [closedInvRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.investor_id]);
          if (closedInvRows[0]?.email) {
            notifyInvestorOfferingClosed({
              investorEmail:   closedInvRows[0].email,
              investorName:    closedInvRows[0].full_name,
              tokenSymbol:     closedSym,
              tokensReceived:  sub.tokens_allocated,
              pricePerToken:   offering.offering_price_usd,
              totalInvestment: sub.amount_usd,
            }).catch(e => console.error('[MAILER] close notifyInvestorOfferingClosed failed:', e.message));
          }
        }
      } catch (notifyErr) {
        console.error('[OFFERING-CLOSE] Investor notification error (non-fatal):', notifyErr.message);
      }

      // FIX 3.1 — notify issuer that their token is now live for secondary trading
      try {
        const { notifyIssuerTokenTradingLive } = require('../utils/mailer');
        const tradingSym = token.token_symbol || token.symbol;
        const modeLabel  = newTradingMode === 'FULL_TRADING' ? 'Full Trading' : 'P2P Trading';

        sendMessage({
          recipientId: offering.issuer_id,
          subject:     `🚀 ${tradingSym} Is Now Live for ${modeLabel}`,
          body:        `Your token ${tradingSym} has successfully completed its primary offering and is now live for ${modeLabel} on the TokenEquityX secondary market. Investors can now buy and sell on the secondary market.`,
          type:        'SYSTEM', category: 'TRADING', referenceId: String(offering.id),
        }).catch(e => console.error('[MESSENGER] offering-close trading-live sendMessage (issuer) failed:', e.message));

        const [tradingIssuerRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [offering.issuer_id]);
        if (tradingIssuerRows[0]?.email) {
          notifyIssuerTokenTradingLive({
            issuerEmail:  tradingIssuerRows[0].email,
            issuerName:   tradingIssuerRows[0].full_name,
            tokenSymbol:  tradingSym,
            marketState:  newTradingMode,
            listingDate:  new Date(),
            oraclePrice:  token.oracle_price || token.current_price_usd,
          }).catch(e => console.error('[MAILER] offering-close notifyIssuerTokenTradingLive failed:', e.message));
        }
      } catch (notifyErr) {
        console.error('[OFFERING-CLOSE] Trading-live notification error (non-fatal):', notifyErr.message);
      }

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

      // FIX 1.3 — notify each investor of the cancellation and refund, then notify issuer
      try {
        const { notifyInvestorOfferingCancelled } = require('../utils/mailer');
        const [cancelTokenRows] = await db.execute('SELECT token_symbol FROM tokens WHERE id = ?', [offering.token_id]);
        const cancelTokenSym = cancelTokenRows[0]?.token_symbol || 'the offering';

        for (const sub of subscriptions) {
          await sendMessage({
            recipientId: sub.investor_id,
            subject:     `📢 Offering Cancelled — Refund Processed — ${cancelTokenSym}`,
            body:        `The ${cancelTokenSym} primary offering has been cancelled. Your subscription of $${parseFloat(sub.amount_usd).toFixed(2)} has been refunded to your wallet balance.`,
            type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
          }).catch(() => {});
          const [invRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [sub.investor_id]);
          if (invRows[0]?.email) {
            notifyInvestorOfferingCancelled({
              investorEmail:  invRows[0].email,
              investorName:   invRows[0].full_name,
              tokenSymbol:    cancelTokenSym,
              amountRefunded: sub.amount_usd,
            }).catch(e => console.error('[MAILER] cancel notifyInvestorOfferingCancelled failed:', e.message));
          }
        }

        await sendMessage({
          recipientId: offering.issuer_id,
          subject:     `📢 Offering Cancelled — ${cancelTokenSym}`,
          body:        `Your primary offering for ${cancelTokenSym} has been cancelled by the platform administrator. All ${subscriptions.length} subscriber fund(s) have been refunded.${reason ? '\n\nReason: ' + reason : ''}`,
          type:        'SYSTEM', category: 'OFFERING', referenceId: String(req.params.id),
        }).catch(() => {});
      } catch (notifyErr) {
        console.error('[OFFERING-CANCEL] Notification error (non-fatal):', notifyErr.message);
      }

      res.json({ success: true, refunded: subscriptions.length, message: `Offering cancelled. ${subscriptions.length} subscribers refunded.` });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'Could not cancel offering: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── GET /api/offerings/:id/subscriptions — admin or issuer view subscriptions
router.get('/:id/subscriptions',
  authenticate,
  async (req, res) => {
    try {
      const role = req.user.role;
      if (!['ADMIN', 'AUDITOR', 'ISSUER'].includes(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Issuers may only see their own offering's subscriptions
      if (role === 'ISSUER') {
        const [ofRows] = await db.execute(
          'SELECT issuer_id FROM primary_offerings WHERE id = ?',
          [req.params.id]
        );
        if (!ofRows.length || String(ofRows[0].issuer_id) !== String(req.user.userId)) {
          return res.status(403).json({ error: 'You are not the issuer of this offering' });
        }
      }
      const [rows] = await db.execute(`
        SELECT os.id, os.investor_id, os.status, os.subscribed_at, os.created_at,
               os.amount_usd, os.tokens_allocated, os.investor_tier,
               u.full_name, u.email,
               kr.investor_tier AS kyc_investor_tier
        FROM offering_subscriptions os
        JOIN users u ON u.id = os.investor_id
        LEFT JOIN kyc_records kr ON kr.user_id = os.investor_id
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

// GET /api/offerings/my-subscriptions — investor's own subscription history
router.get('/my-subscriptions', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT os.id, os.investor_id, os.status, os.created_at,
             os.amount_usd, os.tokens_allocated,
             o.offering_price_usd, o.token_id,
             t.token_symbol, t.token_name
      FROM offering_subscriptions os
      LEFT JOIN primary_offerings o ON o.id = os.offering_id
      LEFT JOIN tokens t ON t.id = o.token_id
      WHERE os.investor_id = $1
      ORDER BY os.created_at DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
