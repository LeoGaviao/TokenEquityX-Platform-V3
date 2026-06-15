const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const upload           = require('../middleware/upload');
const { v4: uuidv4 }   = require('uuid');
const { sendMessage }  = require('../utils/messenger');
const blockchain       = require('../blockchain');

// POST /api/kyc/submit — investor submits KYC
router.post('/submit', authenticate, upload.any(), async (req, res) => {
  const {
    fullName, dateOfBirth, nationality, idType, idNumber,
    addressLine1, addressLine2, city, country,
    countryOfResidence, sourceOfFunds, investmentPurpose,
    investorTier, accreditedInvestor,
    corporateDetails, institutionalDetails,
    riskProfile, riskScore, riskAnswers,
  } = req.body;

  if (!fullName || !country) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const tier       = investorTier || 'RETAIL';
  const corpJson   = corporateDetails      ? (typeof corporateDetails      === 'string' ? corporateDetails      : JSON.stringify(corporateDetails))      : null;
  const instJson   = institutionalDetails  ? (typeof institutionalDetails  === 'string' ? institutionalDetails  : JSON.stringify(institutionalDetails))  : null;
  const riskJson   = riskAnswers           ? (typeof riskAnswers           === 'string' ? riskAnswers           : JSON.stringify(riskAnswers))           : null;

  try {
    // SELECT then INSERT-or-UPDATE (ON CONFLICT requires the unique constraint to exist)
    const [existing] = await db.execute(
      'SELECT id FROM kyc_records WHERE user_id = ?',
      [req.user.userId]
    );

    let kycId;
    if (existing.length > 0) {
      kycId = existing[0].id;
      await db.execute(`
        UPDATE kyc_records
        SET full_name              = ?,
            date_of_birth          = ?,
            nationality            = ?,
            id_type                = ?,
            id_number              = ?,
            address_line1          = ?,
            address_line2          = ?,
            city                   = ?,
            country                = ?,
            country_of_residence   = ?,
            source_of_funds        = ?,
            investment_purpose     = ?,
            investor_tier          = ?,
            accredited_investor    = ?,
            status                 = 'PENDING',
            risk_profile           = ?,
            risk_score             = ?,
            risk_answers           = ?,
            corporate_details      = ?,
            institutional_details  = ?,
            updated_at             = NOW()
        WHERE user_id = ?
      `, [
        fullName, dateOfBirth, nationality, idType, idNumber,
        addressLine1, addressLine2, city, country,
        countryOfResidence || country || null,
        sourceOfFunds || null, investmentPurpose || null,
        tier, accreditedInvestor ? true : false,
        riskProfile || null, parseInt(riskScore) || 0, riskJson,
        corpJson, instJson,
        req.user.userId,
      ]);
    } else {
      kycId = uuidv4();
      await db.execute(`
        INSERT INTO kyc_records
          (id, user_id, full_name, date_of_birth, nationality,
           id_type, id_number, address_line1, address_line2,
           city, country, country_of_residence, source_of_funds, investment_purpose,
           investor_tier, accredited_investor, status,
           risk_profile, risk_score, risk_answers,
           corporate_details, institutional_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
      `, [
        kycId, req.user.userId, fullName, dateOfBirth, nationality,
        idType, idNumber, addressLine1, addressLine2, city, country,
        countryOfResidence || country || null,
        sourceOfFunds || null, investmentPurpose || null,
        tier, accreditedInvestor ? true : false,
        riskProfile || null, parseInt(riskScore) || 0, riskJson,
        corpJson, instJson,
      ]);
    }

    // Process uploaded files — mandate doc stored separately on kyc_records
    let investmentMandateUrl = null;
    if (req.files && req.files.length > 0) {
      const supabase = require('../utils/supabase');
      for (const file of req.files) {
        let fileUrl  = null;
        let filePath = null;
        try {
          filePath = `kyc/${req.user.userId}/${file.fieldname}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
            fileUrl = urlData.publicUrl;
          }
        } catch (uploadErr) {
          console.error('[KYC UPLOAD] Failed:', uploadErr.message);
        }

        if (file.fieldname === 'investment_mandate') {
          investmentMandateUrl = fileUrl;
        } else {
          await db.execute(
            'INSERT INTO kyc_documents (id, kyc_id, doc_type, file_path, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
            [uuidv4(), kycId, file.fieldname || 'document', filePath || file.originalname, fileUrl, file.originalname, file.size]
          );
        }
      }
    }

    if (investmentMandateUrl) {
      await db.execute(
        'UPDATE kyc_records SET investment_mandate_url = ? WHERE id = ?',
        [investmentMandateUrl, kycId]
      );
    }

    // Fetch premium trial duration from platform settings
    let trialDays = 30;
    try {
      const [settingRows] = await db.execute(
        `SELECT value FROM platform_settings WHERE key = 'premium_trial_days_new_investors'`
      );
      if (settingRows.length > 0) trialDays = parseInt(settingRows[0].value) || 30;
    } catch {}

    // Update user: kyc_status, investor_tier, premium trial fields
    await db.execute(`
      UPDATE users
      SET kyc_status                   = 'PENDING',
          investor_tier                = ?,
          premium_trial_start_date     = NOW(),
          premium_trial_end_date       = NOW() + (? * INTERVAL '1 day'),
          premium_subscription_status  = 'TRIAL'
      WHERE id = ?
    `, [tier, trialDays, req.user.userId]);

    logger.info('KYC submitted', { userId: req.user.userId, tier });

    // Confirmation email — non-fatal
    try {
      const { notifyInvestorKycSubmitted } = require('../utils/mailer');
      const [uRows] = await db.execute('SELECT email, full_name FROM users WHERE id = ?', [req.user.userId]);
      if (uRows.length > 0 && uRows[0].email) {
        notifyInvestorKycSubmitted({
          investorEmail: uRows[0].email,
          investorName:  uRows[0].full_name || 'Investor',
        }).catch(e => console.error('[MAILER] notifyInvestorKycSubmitted failed:', e.message));
      }
    } catch (mailErr) {
      console.error('[KYC SUBMIT] Email notification error (non-fatal):', mailErr.message);
    }

    res.json({
      success: true,
      kycId,
      status:  'PENDING',
      message: 'KYC submitted. Review takes 24-48 hours.',
    });
  } catch (err) {
    logger.error('KYC submission failed', { error: err.message });
    res.status(500).json({ error: 'KYC submission failed' });
  }
});

// GET /api/kyc/my-record — full kyc_record for the current user (including corporate/institutional details)
router.get('/my-record', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT k.*, u.kyc_status as user_kyc_status,
             u.investor_tier, u.premium_subscription_status,
             u.premium_trial_end_date
      FROM kyc_records k
      JOIN users u ON u.id = k.user_id
      WHERE k.user_id = ?
      ORDER BY k.submitted_at DESC
      LIMIT 1
    `, [req.user.userId]);

    if (rows.length === 0) return res.json({ exists: false });

    const record = rows[0];
    if (typeof record.corporate_details === 'string') {
      try { record.corporate_details = JSON.parse(record.corporate_details); } catch {}
    }
    if (typeof record.institutional_details === 'string') {
      try { record.institutional_details = JSON.parse(record.institutional_details); } catch {}
    }
    res.json({ exists: true, ...record });
  } catch (err) {
    logger.error('KYC my-record failed', { error: err.message });
    res.status(500).json({ error: 'Could not fetch KYC record' });
  }
});

// GET /api/kyc/status — get own KYC status
router.get('/status', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT k.*, u.kyc_status as user_kyc_status
      FROM kyc_records k
      JOIN users u ON u.id = k.user_id
      WHERE k.user_id = ?
      ORDER BY k.submitted_at DESC
      LIMIT 1
    `, [req.user.userId]);

    if (rows.length === 0) {
      return res.json({ status: 'NONE', message: 'No KYC record found' });
    }
    res.json(rows[0]);
  } catch (err) {
    logger.error('KYC status fetch failed', { error: err.message });
    res.status(500).json({ error: 'Could not fetch KYC status' });
  }
});

// GET /api/kyc/status/:walletAddress — public status check by wallet
router.get('/status/:walletAddress', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT k.status, k.submitted_at, k.reviewed_at, k.expires_at,
             u.kyc_status
      FROM kyc_records k
      JOIN users u ON u.id = k.user_id
      WHERE u.wallet_address = ?
      ORDER BY k.submitted_at DESC
      LIMIT 1
    `, [req.params.walletAddress.toLowerCase()]);

    if (rows.length === 0) {
      return res.json({ status: 'NONE' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch KYC status' });
  }
});

// GET /api/kyc/approved — recently approved KYC records (admin view)
router.get('/approved',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT k.id, k.full_name, k.investor_tier, k.reviewed_at, k.expires_at,
               k.reviewer_notes, k.kyc_reference,
               u.email, u.wallet_address
        FROM kyc_records k
        JOIN users u ON u.id = k.user_id
        WHERE k.status = 'APPROVED'
        ORDER BY k.reviewed_at DESC
        LIMIT 50
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch approved KYC records' });
    }
  }
);

// GET /api/kyc/pending — list pending KYC (auditor/admin only)
router.get('/pending',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT k.*, u.wallet_address, u.email, u.full_name as user_full_name,
               COALESCE(
                 (SELECT json_agg(json_build_object('doc_type', d.doc_type, 'file_url', d.file_url, 'file_name', d.file_name, 'file_size', d.file_size))
                  FROM kyc_documents d WHERE d.kyc_id = k.id AND d.file_url IS NOT NULL),
                 '[]'::json
               ) as documents
        FROM kyc_records k
        JOIN users u ON u.id = k.user_id
        WHERE k.status IN ('PENDING', 'APPROVED', 'REJECTED')
        ORDER BY k.submitted_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch pending KYC' });
    }
  }
);

// PUT /api/kyc/approve/:kycId — approve KYC
router.put('/approve/:kycId',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { reviewerNotes, investorTier, kycReference } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [records] = await conn.execute(
        'SELECT * FROM kyc_records WHERE id = ?',
        [req.params.kycId]
      );
      if (records.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'KYC record not found' });
      }

      await conn.execute(`
        UPDATE kyc_records
        SET status          = 'APPROVED',
            reviewed_at     = NOW(),
            reviewer_id     = ?,
            reviewer_notes  = ?,
            kyc_reference   = ?,
            expires_at      = NOW() + (? * INTERVAL '1 day')
        WHERE id = ?
      `, [
        req.user.userId,
        reviewerNotes || '',
        kycReference  || '',
        process.env.MAX_KYC_EXPIRY_DAYS || 365,
        req.params.kycId
      ]);

      await conn.execute(
        'UPDATE users SET kyc_status = ? WHERE id = ?',
        ['APPROVED', records[0].user_id]
      );

      await conn.commit();

      const [userRows] = await db.execute('SELECT email, full_name, wallet_address, role FROM users WHERE id = ?', [records[0].user_id]);
      const approvedUser = userRows[0];
      const userRole = approvedUser?.role || 'INVESTOR';

      if (approvedUser?.wallet_address) {
        blockchain.approveKYCOnChain(approvedUser.wallet_address)
          .catch(e => console.error('[BLOCKCHAIN] approveKYCOnChain skipped:', e.message));
      }

      const platformMessages = {
        INVESTOR:        'Your KYC has been approved. You can now deposit funds and start investing.',
        ISSUER:          'Your KYC has been approved. Please proceed to submit your Entity KYC to continue your tokenisation application.',
        AUDITOR:         'Your KYC has been approved. You can now receive audit assignments.',
        PARTNER:         'Your KYC has been approved. Your partner dashboard is now active.',
        BANKING_PARTNER: 'Your KYC has been approved. Your banking partner portal is now active.',
      };

      await sendMessage({
        recipientId: records[0].user_id,
        subject:     '✅ KYC Approved',
        body:        platformMessages[userRole] || platformMessages.INVESTOR,
        type:        'SYSTEM',
        category:    'KYC',
        referenceId: req.params.kycId,
      }).catch(() => {});

      if (approvedUser?.email) {
        const {
          notifyInvestorKycApproved,
          notifyIssuerKycApproved,
          notifyAuditorKycApproved,
          notifyPartnerKycApproved,
          notifyBankingPartnerKycApproved,
        } = require('../utils/mailer');

        const name = approvedUser.full_name || userRole.charAt(0) + userRole.slice(1).toLowerCase();

        if (userRole === 'ISSUER') {
          notifyIssuerKycApproved({ issuerEmail: approvedUser.email, issuerName: name })
            .catch(e => console.error('[MAILER] notifyIssuerKycApproved failed:', e.message));
        } else if (userRole === 'AUDITOR') {
          notifyAuditorKycApproved({ auditorEmail: approvedUser.email, auditorName: name })
            .catch(e => console.error('[MAILER] notifyAuditorKycApproved failed:', e.message));
        } else if (userRole === 'PARTNER') {
          notifyPartnerKycApproved({ partnerEmail: approvedUser.email, partnerName: name })
            .catch(e => console.error('[MAILER] notifyPartnerKycApproved failed:', e.message));
        } else if (userRole === 'BANKING_PARTNER') {
          notifyBankingPartnerKycApproved({ bankingPartnerEmail: approvedUser.email, bankingPartnerName: name })
            .catch(e => console.error('[MAILER] notifyBankingPartnerKycApproved failed:', e.message));
        } else {
          notifyInvestorKycApproved({ investorEmail: approvedUser.email, investorName: name })
            .catch(e => console.error('[MAILER] notifyInvestorKycApproved failed:', e.message));
        }
      }

      logger.info('KYC approved', {
        kycId:      req.params.kycId,
        reviewerId: req.user.userId
      });

      res.json({ success: true, message: 'KYC approved' });
    } catch (err) {
      await conn.rollback();
      logger.error('KYC approval failed', { error: err.message });
      res.status(500).json({ error: 'Could not approve KYC' });
    } finally {
      conn.release();
    }
  }
);

// PUT /api/kyc/reject/:kycId — reject KYC
router.put('/reject/:kycId',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { reviewerNotes } = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [records] = await conn.execute(
        'SELECT user_id FROM kyc_records WHERE id = ?',
        [req.params.kycId]
      );
      if (records.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'KYC record not found' });
      }

      await conn.execute(`
        UPDATE kyc_records
        SET status         = 'REJECTED',
            reviewed_at    = NOW(),
            reviewer_id    = ?,
            reviewer_notes = ?
        WHERE id = ?
      `, [req.user.userId, reviewerNotes || '', req.params.kycId]);

      await conn.execute(
        'UPDATE users SET kyc_status = ? WHERE id = ?',
        ['REJECTED', records[0].user_id]
      );

      await conn.commit();

      const [rejectedUserRows] = await db.execute('SELECT email, full_name, wallet_address, role FROM users WHERE id = ?', [records[0].user_id]);
      const rejectedUser = rejectedUserRows[0];
      const userRole = rejectedUser?.role || 'INVESTOR';

      if (rejectedUser?.wallet_address) {
        blockchain.revokeKYCOnChain(rejectedUser.wallet_address)
          .catch(e => console.error('[BLOCKCHAIN] revokeKYCOnChain skipped:', e.message));
      }

      const portalDashboard = {
        INVESTOR:        'investor dashboard',
        ISSUER:          'Issuer Portal',
        AUDITOR:         'Auditor Dashboard',
        PARTNER:         'Partner Dashboard',
        BANKING_PARTNER: 'Banking Partner Portal',
      };

      await sendMessage({
        recipientId: records[0].user_id,
        subject:     '❌ KYC Not Approved',
        body:        `Your identity verification submission could not be approved at this time. Reason: ${reviewerNotes || 'Please resubmit with clearer documents'}. Please resubmit your KYC documents through your ${portalDashboard[userRole] || 'dashboard'}.`,
        type:        'SYSTEM',
        category:    'KYC',
        referenceId: req.params.kycId,
      }).catch(() => {});

      if (rejectedUser?.email) {
        try {
          const {
            notifyInvestorKycRejected,
            notifyIssuerKycRejected,
            notifyStaffKycRejected,
          } = require('../utils/mailer');
          const name = rejectedUser.full_name || userRole.charAt(0) + userRole.slice(1).toLowerCase();

          if (userRole === 'ISSUER') {
            notifyIssuerKycRejected({
              issuerEmail: rejectedUser.email,
              issuerName:  name,
              reason:      reviewerNotes || null,
            }).catch(e => console.error('[MAILER] notifyIssuerKycRejected failed:', e.message));
          } else if (['AUDITOR', 'PARTNER', 'BANKING_PARTNER'].includes(userRole)) {
            notifyStaffKycRejected({
              userEmail: rejectedUser.email,
              userName:  name,
              role:      userRole,
              reason:    reviewerNotes || null,
            }).catch(e => console.error('[MAILER] notifyStaffKycRejected failed:', e.message));
          } else {
            notifyInvestorKycRejected({
              investorEmail: rejectedUser.email,
              investorName:  name,
              reason:        reviewerNotes || null,
            }).catch(e => console.error('[MAILER] notifyInvestorKycRejected failed:', e.message));
          }
        } catch (mailErr) {
          console.error('[KYC REJECT] Email notification error (non-fatal):', mailErr.message);
        }
      }

      logger.info('KYC rejected', { kycId: req.params.kycId, reviewerId: req.user.userId });
      res.json({ success: true, message: 'KYC rejected' });
    } catch (err) {
      await conn.rollback();
      logger.error('KYC rejection failed', { error: err.message });
      res.status(500).json({ error: 'Could not reject KYC' });
    } finally {
      conn.release();
    }
  }
);


// GET /api/kyc/holdings/:walletAddress — returns investor token holdings
router.get('/holdings/:walletAddress', authenticate, async (req, res) => {
  // Admins may view any user's holdings; all others may only view their own
  const isAdmin = req.user.role === 'ADMIN';
  const isOwnRequest = req.params.walletAddress === req.user.userId ||
                       req.params.walletAddress === req.user.wallet;
  if (!isAdmin && !isOwnRequest) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const [userRows] = await db.execute(
      'SELECT id FROM users WHERE wallet_address = ? OR id = ?',
      [req.params.walletAddress.toLowerCase(), req.params.walletAddress]
    );
    if (userRows.length === 0) return res.json([]);

    const [holdings] = await db.execute(`
      SELECT
        th.id,
        th.user_id,
        th.token_id,
        th.balance,
        th.reserved,
        th.average_cost_usd,
        COALESCE(t.token_symbol, t.symbol) as symbol,
        COALESCE(t.token_name, t.name) as name,
        t.asset_type,
        t.current_price_usd,
        t.oracle_price,
        t.market_state,
        t.trading_mode,
        (th.balance * COALESCE(t.oracle_price, t.current_price_usd, 0)) AS current_value_usd,
        (th.balance * COALESCE(t.oracle_price, t.current_price_usd, 0))
          - (th.balance * th.average_cost_usd) AS unrealised_pnl
      FROM token_holdings th
      JOIN tokens t ON t.id = th.token_id
      WHERE th.user_id = ?
      AND th.balance > 0
      ORDER BY current_value_usd DESC
    `, [userRows[0].id]);

    res.json(holdings);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch holdings' });
  }
});

module.exports = router;