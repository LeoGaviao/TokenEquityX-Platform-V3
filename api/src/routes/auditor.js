const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { v4: uuidv4 }   = require('uuid');
const { calculateValuation } = require('../services/valuation');
const { generateDataHash }   = require('../services/dataHash');
const mailer      = require('../utils/mailer');
const blockchain  = require('../blockchain');

// GET /api/auditor/queue
router.get('/queue',
  authenticate,
  requireRole('ADMIN','AUDITOR','COMPLIANCE_OFFICER'),
  async (req, res) => {
    try {
      const [kyc] = await db.execute(
        "SELECT 'KYC' as type, id, user_id as entity_id, submitted_at as created_at, status FROM kyc_records WHERE status = 'PENDING' LIMIT 20"
      );
      const [prices] = await db.execute(
        "SELECT 'PRICE' as type, id, token_id as entity_id, submitted_at as created_at, status FROM oracle_prices WHERE status = 'PENDING' LIMIT 20"
      );
      const [data] = await db.execute(
        "SELECT 'DATA' as type, id, token_id as entity_id, submitted_at as created_at, status FROM data_submissions WHERE status = 'PENDING' LIMIT 20"
      );
      res.json({ kyc, prices, data, totalPending: kyc.length + prices.length + data.length });
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch queue' });
    }
  }
);

// POST /api/auditor/data-submissions
router.post('/data-submissions', authenticate, async (req, res) => {
  const { tokenSymbol, dataType, dataJson, ipfsHash } = req.body;
  if (!tokenSymbol || !dataType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const [tokens] = await db.execute(
      'SELECT id FROM tokens WHERE symbol = ? OR token_symbol = ?',
      [tokenSymbol.toUpperCase(), tokenSymbol.toUpperCase()]
    );
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    const id = uuidv4();
    await db.execute(`
      INSERT INTO data_submissions
        (id, token_id, issuer_wallet, data_type, data_json, ipfs_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `, [id, tokens[0].id, req.user.userId, dataType, JSON.stringify(dataJson), ipfsHash]);
    res.json({ success: true, submissionId: id });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit data' });
  }
});

// PUT /api/auditor/data-submissions/:id/approve — approve + auto-run valuation
router.put('/data-submissions/:id/approve',
  authenticate,
  requireRole('ADMIN','AUDITOR'),
  async (req, res) => {
    const { notes } = req.body;
    try {
      // 1. Mark approved
      await db.execute(`
        UPDATE data_submissions
        SET status = 'APPROVED', auditor_id = ?, auditor_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [req.user.userId, notes || '', req.params.id]);

      // 2. Fetch submission + token for auto-valuation
      const [rows] = await db.execute(`
        SELECT ds.*, COALESCE(t.token_symbol, t.symbol) as token_symbol, t.asset_class, t.asset_type,
               t.total_supply, t.id as token_id, t.sector
        FROM data_submissions ds
        JOIN tokens t ON t.id = ds.token_id
        WHERE ds.id = ?
      `, [req.params.id]);

      if (rows.length === 0) return res.json({ success: true });

      const sub = rows[0];
      let dataObj = {};
      try { dataObj = typeof sub.data_json === 'string' ? JSON.parse(sub.data_json) : (sub.data_json || {}); } catch {}

      const assetType   = sub.asset_type || sub.asset_class || 'EQUITY';
      const totalSupply = Number(sub.total_supply) || 1000000;

      try {
        // 3. Run valuation engine
        const valuationData = {
          ...dataObj,
          sector:       sub.sector || dataObj.sector || 'DEFAULT',
          growthRate:   (Number(dataObj.growthRatePct)   || 15) / 100,
          discountRate: (Number(dataObj.discountRatePct) || 12) / 100,
          freeCashFlow: Number(dataObj.freeCashFlow) || (Number(dataObj.revenueTTM) * 0.15) || 0,
        };

        const result        = calculateValuation(assetType, valuationData);
        const blendedEV     = result.blended || 0;
        const totalDebt     = Number(dataObj.totalDebt) || 0;
        const cash          = Number(dataObj.cash)      || 0;
        const equityValue   = blendedEV - totalDebt + cash;
        const pricePerToken = Math.max(totalSupply > 0 ? equityValue / totalSupply : 1.00, 1.00);

        // 4. Generate data hash for on-chain proof
        const dataHash = generateDataHash(dataObj);

        // 5. Update token oracle price
        await db.execute(`
          UPDATE tokens SET oracle_price = ?, current_price_usd = ?, updated_at = NOW()
          WHERE id = ?
        `, [pricePerToken.toFixed(6), pricePerToken.toFixed(6), sub.token_id]);
        blockchain.updatePriceOnChain(sub.token_symbol, pricePerToken)
          .catch(e => console.error('[BLOCKCHAIN] updatePriceOnChain skipped:', e.message));

        // 6. Record in oracle_prices with data hash
        try {
          await db.execute(`
            INSERT INTO oracle_prices (token_symbol, price, data_hash, set_by, source, status)
            VALUES (?, ?, ?, ?, 'AUTO_VALUATION', 'APPROVED')
          `, [sub.token_symbol, pricePerToken.toFixed(6), dataHash, req.user.userId]);
        } catch {}

        // 7. Audit log
        try {
          await db.execute(`
            INSERT INTO audit_logs (action, performed_by, target_entity, details)
            VALUES ('AUTO_VALUATION_TRIGGERED', ?, ?, ?)
          `, [
            req.user.userId, sub.token_symbol,
            `Auto-valuation: ${assetType} | Price: $${pricePerToken.toFixed(4)} | Hash: ${dataHash}`
          ]);
        } catch {}

        return res.json({
          success: true,
          autoValuation: {
            pricePerToken: pricePerToken.toFixed(6),
            assetType,
            dataHash,
            blendedEV: Math.round(blendedEV),
          }
        });

      } catch (valuationErr) {
        // Approval succeeded even if valuation failed
        console.error('Auto-valuation failed:', valuationErr.message);
        return res.json({ success: true, autoValuationError: valuationErr.message });
      }

    } catch (err) {
      res.status(500).json({ error: 'Could not approve submission' });
    }
  }
);

// PUT /api/auditor/data-submissions/:id/reject
router.put('/data-submissions/:id/reject',
  authenticate,
  requireRole('ADMIN','AUDITOR'),
  async (req, res) => {
    const { notes } = req.body;
    try {
      await db.execute(`
        UPDATE data_submissions
        SET status = 'REJECTED', auditor_id = ?, auditor_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [req.user.userId, notes || '', req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject submission' });
    }
  }
);

// GET /api/auditor/completed
router.get('/completed', authenticate, requireRole('AUDITOR','ADMIN'), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        ds.id, ds.token_symbol, ds.status,
        ds.entity_name, ds.updated_at as reviewed_at,
        ds.admin_notes, ds.audit_report, ds.assigned_auditor, ds.data_json,
        COALESCE(ek.entity_name, ds.entity_name, u.full_name, ds.issuer_wallet) as display_name,
        COALESCE(ek.registration_number, '') as registration_number,
        u.email as issuer_email
      FROM data_submissions ds
      LEFT JOIN entity_kyc ek ON ek.user_id = ds.issuer_wallet
      LEFT JOIN users u ON u.id = ds.issuer_wallet
      WHERE ds.status IN ('AUDITOR_APPROVED','ADMIN_APPROVED','REJECTED')
      ORDER BY ds.updated_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error('Auditor completed error:', err.message);
    res.status(500).json({ error: 'Failed to fetch completed reviews: ' + err.message });
  }
});

// ── Independence Declaration endpoints ───────────────────────────────────────

// POST /api/auditor/declarations — auditor submits independence declaration
router.post('/declarations',
  authenticate,
  requireRole('AUDITOR'),
  async (req, res) => {
    const {
      submission_id, no_financial_relationship, no_token_holdings,
      no_personal_relationship, professional_indemnity, icaz_member,
      practising_certificate, insurance_amount, declaration_text, digital_signature,
    } = req.body;

    if (!submission_id)        return res.status(400).json({ error: 'submission_id is required' });
    if (!practising_certificate) return res.status(400).json({ error: 'practising_certificate is required' });
    if (!declaration_text || declaration_text.trim().length < 50)
      return res.status(400).json({ error: 'declaration_text must be at least 50 characters' });

    try {
      const [subs] = await db.execute(
        'SELECT id, entity_name, token_symbol, assigned_auditor FROM data_submissions WHERE id = ?',
        [submission_id]
      );
      if (subs.length === 0) return res.status(404).json({ error: 'Submission not found' });
      const sub = subs[0];
      if (sub.assigned_auditor !== req.user.userId)
        return res.status(403).json({ error: 'You are not assigned to this submission' });

      // Block duplicate active declarations
      const [existing] = await db.execute(
        "SELECT id FROM auditor_declarations WHERE auditor_id = ? AND submission_id = ? AND status IN ('PENDING','APPROVED')",
        [req.user.userId, submission_id]
      );
      if (existing.length > 0)
        return res.status(409).json({ error: 'A declaration is already pending or approved for this submission' });

      const allChecked = !!(no_financial_relationship && no_token_holdings &&
        no_personal_relationship && professional_indemnity && icaz_member);
      const status         = allChecked ? 'PENDING' : 'REJECTED';
      const rejectionReason = allChecked ? null : 'One or more independence requirements not met at submission';

      const [inserted] = await db.execute(
        `INSERT INTO auditor_declarations
           (auditor_id, submission_id, no_financial_relationship, no_token_holdings,
            no_personal_relationship, professional_indemnity, icaz_member,
            practising_certificate, insurance_amount, declaration_text, digital_signature,
            status, rejection_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          req.user.userId, submission_id,
          no_financial_relationship, no_token_holdings, no_personal_relationship,
          professional_indemnity, icaz_member, practising_certificate,
          insurance_amount || null, declaration_text.trim(), digital_signature || null,
          status, rejectionReason,
        ]
      );

      if (status === 'PENDING') {
        await db.execute(
          "UPDATE data_submissions SET status = 'DECLARATION_PENDING', updated_at = NOW() WHERE id = ?",
          [submission_id]
        );
        // Notify admin
        const [adminRows] = await db.execute(
          "SELECT email, full_name FROM users WHERE role = 'ADMIN' LIMIT 1"
        );
        const [auditorRows] = await db.execute(
          'SELECT full_name, email FROM users WHERE id = ?', [req.user.userId]
        );
        if (adminRows.length > 0) {
          mailer.notifyAdminAuditorDeclarationSubmitted({
            adminEmail:    adminRows[0].email,
            auditorName:   auditorRows[0]?.full_name || 'Auditor',
            auditorEmail:  auditorRows[0]?.email || '',
            issuerName:    sub.entity_name || sub.token_symbol,
            tokenSymbol:   sub.token_symbol,
            submissionId:  submission_id,
            certificate:   practising_certificate,
          }).catch(e => console.error('[MAILER] declaration submitted to admin failed:', e.message));
        }
      }

      res.json({
        success: true,
        id:      inserted[0]?.id,
        status,
        message: status === 'PENDING'
          ? 'Declaration submitted successfully. Awaiting admin review before you may proceed.'
          : 'Declaration automatically rejected — all independence checkboxes must be confirmed.',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/auditor/declarations/:submissionId — get declaration for a submission
router.get('/declarations/:submissionId',
  authenticate,
  requireRole('ADMIN','AUDITOR','COMPLIANCE_OFFICER'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT ad.*, u.full_name as auditor_name, u.email as auditor_email,
                r.full_name as reviewer_name
         FROM auditor_declarations ad
         LEFT JOIN users u ON u.id = ad.auditor_id
         LEFT JOIN users r ON r.id = ad.reviewed_by
         WHERE ad.submission_id = ?
         ORDER BY ad.created_at DESC LIMIT 5`,
        [req.params.submissionId]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/auditor/declarations/:id/approve — admin approves declaration
router.put('/declarations/:id/approve',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT ad.*, ds.entity_name, ds.token_symbol, ds.id as sub_id,
                u.email as auditor_email, u.full_name as auditor_name
         FROM auditor_declarations ad
         JOIN data_submissions ds ON ds.id = ad.submission_id
         JOIN users u ON u.id = ad.auditor_id
         WHERE ad.id = ?`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Declaration not found' });
      const decl = rows[0];
      if (decl.status === 'APPROVED') return res.status(400).json({ error: 'Already approved' });

      await db.execute(
        "UPDATE auditor_declarations SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
        [req.user.userId, req.params.id]
      );
      // Advance submission to AUDITOR_REVIEW so auditor can proceed
      await db.execute(
        "UPDATE data_submissions SET status = 'AUDITOR_REVIEW', updated_at = NOW() WHERE id = ?",
        [decl.sub_id]
      );

      mailer.notifyAuditorDeclarationApproved({
        auditorEmail: decl.auditor_email,
        auditorName:  decl.auditor_name,
        issuerName:   decl.entity_name || decl.token_symbol,
        tokenSymbol:  decl.token_symbol,
      }).catch(e => console.error('[MAILER] declaration approved failed:', e.message));

      res.json({ success: true, message: 'Declaration approved. Auditor may now proceed with the review.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/auditor/declarations/:id/reject — admin rejects declaration
router.put('/declarations/:id/reject',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { rejection_reason } = req.body;
    if (!rejection_reason?.trim()) return res.status(400).json({ error: 'rejection_reason is required' });
    try {
      const [rows] = await db.execute(
        `SELECT ad.*, ds.entity_name, ds.token_symbol, ds.id as sub_id,
                u.email as auditor_email, u.full_name as auditor_name
         FROM auditor_declarations ad
         JOIN data_submissions ds ON ds.id = ad.submission_id
         JOIN users u ON u.id = ad.auditor_id
         WHERE ad.id = ?`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Declaration not found' });
      const decl = rows[0];

      await db.execute(
        "UPDATE auditor_declarations SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?, updated_at = NOW() WHERE id = ?",
        [req.user.userId, rejection_reason.trim(), req.params.id]
      );
      await db.execute(
        "UPDATE data_submissions SET status = 'DECLARATION_REJECTED', updated_at = NOW() WHERE id = ?",
        [decl.sub_id]
      );

      mailer.notifyAuditorDeclarationRejected({
        auditorEmail:    decl.auditor_email,
        auditorName:     decl.auditor_name,
        issuerName:      decl.entity_name || decl.token_symbol,
        tokenSymbol:     decl.token_symbol,
        rejectionReason: rejection_reason.trim(),
      }).catch(e => console.error('[MAILER] declaration rejected failed:', e.message));

      res.json({ success: true, message: 'Declaration rejected. Auditor must resubmit.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
