const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const upload           = require('../middleware/upload');
const { v4: uuidv4 }   = require('uuid');
const { sendMessage }  = require('../utils/messenger');

// POST /api/kyc/submit — investor submits KYC
router.post('/submit', authenticate, upload.array('documents', 5), async (req, res) => {
  const {
    fullName, dateOfBirth, nationality, idType, idNumber,
    addressLine1, addressLine2, city, country,
    investorTier, accreditedInvestor
  } = req.body;

  if (!fullName || !country) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const kycId = uuidv4();

    await db.execute(`
      INSERT INTO kyc_records
        (id, user_id, full_name, date_of_birth, nationality,
         id_type, id_number, address_line1, address_line2,
         city, country, investor_tier, accredited_investor, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      ON CONFLICT (user_id) DO UPDATE SET
        full_name  = EXCLUDED.full_name,
        status     = 'PENDING',
        updated_at = NOW()
    `, [
      kycId, req.user.userId, fullName, dateOfBirth, nationality,
      idType, idNumber, addressLine1, addressLine2, city, country,
      investorTier || 'RETAIL', accreditedInvestor ? true : false
    ]);

    // Save uploaded documents to Supabase
    if (req.files && req.files.length > 0) {
      const supabase = require('../utils/supabase');
      for (const file of req.files) {
        let fileUrl = null;
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
        await db.execute(
          'INSERT INTO kyc_documents (id, kyc_id, doc_type, file_path, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
          [uuidv4(), kycId, file.fieldname || 'document', filePath || file.originalname, fileUrl, file.originalname, file.size]
        );
      }
    }

    await db.execute(
      'UPDATE users SET kyc_status = ? WHERE id = ?',
      ['PENDING', req.user.userId]
    );

    logger.info('KYC submitted', { userId: req.user.userId });

    res.json({
      success: true,
      kycId,
      status:  'PENDING',
      message: 'KYC submitted. Review takes 24-48 hours.'
    });
  } catch (err) {
    logger.error('KYC submission failed', { error: err.message });
    res.status(500).json({ error: 'KYC submission failed' });
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
    try {
      const [records] = await db.execute(
        'SELECT * FROM kyc_records WHERE id = ?',
        [req.params.kycId]
      );
      if (records.length === 0) {
        return res.status(404).json({ error: 'KYC record not found' });
      }

      await db.execute(`
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

      await db.execute(
        'UPDATE users SET kyc_status = ? WHERE id = ?',
        ['APPROVED', records[0].user_id]
      );

      await sendMessage({
        recipientId: records[0].user_id,
        subject:     `✅ KYC Approved`,
        body:        `Your identity verification (KYC) has been approved. You now have full access to all platform features including investing and trading.`,
        type:        'SYSTEM',
        category:    'KYC',
        referenceId: req.params.kycId,
      }).catch(() => {});

      logger.info('KYC approved', {
        kycId:      req.params.kycId,
        reviewerId: req.user.userId
      });

      res.json({ success: true, message: 'KYC approved' });
    } catch (err) {
      logger.error('KYC approval failed', { error: err.message });
      res.status(500).json({ error: 'Could not approve KYC' });
    }
  }
);

// PUT /api/kyc/reject/:kycId — reject KYC
router.put('/reject/:kycId',
  authenticate,
  requireRole('ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { reviewerNotes } = req.body;
    try {
      await db.execute(`
        UPDATE kyc_records
        SET status         = 'REJECTED',
            reviewed_at    = NOW(),
            reviewer_id    = ?,
            reviewer_notes = ?
        WHERE id = ?
      `, [req.user.userId, reviewerNotes || '', req.params.kycId]);

      const [records] = await db.execute(
        'SELECT user_id FROM kyc_records WHERE id = ?',
        [req.params.kycId]
      );
      if (records.length > 0) {
        await db.execute(
          'UPDATE users SET kyc_status = ? WHERE id = ?',
          ['REJECTED', records[0].user_id]
        );
        await sendMessage({
          recipientId: records[0].user_id,
          subject:     `❌ KYC Not Approved`,
          body:        `Your identity verification submission could not be approved at this time. Reason: ${reviewerNotes || 'Please resubmit with clearer documents'}. Please resubmit your KYC documents.`,
          type:        'SYSTEM',
          category:    'KYC',
          referenceId: req.params.kycId,
        }).catch(() => {});
      }

      res.json({ success: true, message: 'KYC rejected' });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject KYC' });
    }
  }
);


// GET /api/kyc/holdings/:walletAddress — returns investor token holdings
router.get('/holdings/:walletAddress', async (req, res) => {
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