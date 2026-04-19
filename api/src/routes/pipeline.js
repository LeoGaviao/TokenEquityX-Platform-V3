const router  = require('express').Router();
const db      = require('../db/pool');
const logger  = require('../utils/logger');
const { authenticate }            = require('../middleware/auth');
const { requireRole, requireKYC } = require('../middleware/roles');
const { generateDataHash }        = require('../services/dataHash');
const { calculateValuation }      = require('../services/valuation');
const { v4: uuidv4 }              = require('uuid');
const upload = require('../middleware/upload');
const { uploadToSupabase } = require('../middleware/upload');

// ── DATA SCHEMAS BY ASSET TYPE ────────────────────────────────

const REQUIRED_FIELDS = {
  EQUITY:         ['revenueTTM', 'growthRatePct'],
  REAL_ESTATE:    ['propertyValuation', 'totalDebt'],
  MINING:         ['totalResourceTonnes', 'gradePercent', 'commodityPricePerTonne', 'miningCostPerTonne'],
  INFRASTRUCTURE: ['annualRevenue', 'operatingMarginPct'],
  REIT:           ['propertyValuation', 'netOperatingIncome'],
  BOND:           ['faceValue', 'couponRatePct', 'marketYieldPct', 'periodsRemaining'],
  OTHER:          ['revenueTTM']
};

function validateFields(assetType, data) {
  const required = REQUIRED_FIELDS[assetType?.toUpperCase()] || REQUIRED_FIELDS.OTHER;
  return required.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
}

// POST /api/pipeline/submit — issuer submits financial data
router.post('/submit', authenticate, requireKYC, upload.array('documents', 10), async (req, res) => {
  const { tokenSymbol, dataType, ipfsHash, periodLabel } = req.body;
  const financialData = typeof req.body.financialData === 'string'
    ? JSON.parse(req.body.financialData)
    : req.body.financialData;

  if (!tokenSymbol || !financialData) {
    return res.status(400).json({ error: 'tokenSymbol and financialData required' });
  }

  try {
    const [tokens] = await db.execute(`
      SELECT t.*, s.asset_type, s.sector, s.owner_user_id
      FROM tokens t
      JOIN spvs s ON s.id = t.spv_id
      WHERE t.token_symbol = ?
    `, [tokenSymbol.toUpperCase()]);

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    const token = tokens[0];

    const missing = validateFields(token.asset_type, financialData);
    if (missing.length > 0) {
      return res.status(400).json({
        error:  'Missing required fields for ' + token.asset_type,
        missing
      });
    }

    // Upload documents to Supabase
    const uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploaded = await uploadToSupabase(file, 'pipeline', req.user.userId);
          uploadedDocs.push(uploaded);
        } catch (uploadErr) {
          console.error('Document upload failed:', uploadErr.message);
        }
      }
    }

    const dataHash = generateDataHash({
      tokenSymbol: tokenSymbol.toUpperCase(),
      financialData,
      periodLabel,
      timestamp: new Date().toISOString()
    });

    const submissionId = uuidv4();
    const period       = periodLabel || new Date().toISOString().slice(0, 7);

    await db.execute(`
      INSERT INTO data_submissions
        (token_symbol, entity_name, issuer_wallet, period, submission_type,
         data_json, document_count, status, reference_number)
      VALUES (?, ?, ?, ?, 'FINANCIAL_DATA', ?, ?, 'PENDING', ?)
    `, [
      tokenSymbol.toUpperCase(),
      token.name || token.token_name || tokenSymbol.toUpperCase(),
      req.user.userId,
      period,
      JSON.stringify({ financialData, periodLabel, dataHash, documents: uploadedDocs }),
      uploadedDocs.length,
      submissionId,
    ]);

    try {
      await db.execute(
        'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
        ['DATA_SUBMITTED', req.user.userId, tokenSymbol.toUpperCase(), JSON.stringify({ dataHash, period })]
      );
    } catch {}

    // Send application received email
    try {
      const [userRows] = await db.execute(
        'SELECT full_name, email FROM users WHERE id = ?', [req.user.userId]
      );
      const issuer = userRows[0] || {};
      const [settingsRows] = await db.execute(
        "SELECT value FROM platform_settings WHERE key = 'applications_meeting_day'"
      );
      const meetingDay = settingsRows[0]?.value || 'Tuesday';
      if (issuer.email) {
        const mailer = require('../utils/mailer');
        await mailer.notifyIssuerApplicationReceived({
          issuerEmail:     issuer.email,
          issuerName:      issuer.full_name || 'Issuer',
          tokenSymbol:     tokenSymbol.toUpperCase(),
          entityName:      token.name || token.token_name || tokenSymbol.toUpperCase(),
          referenceNumber: submissionId,
          meetingDay,
        }).catch(err => console.error('Email failed:', err.message));
      }
    } catch (emailErr) {
      console.error('Application received email failed:', emailErr.message);
    }

    logger.info('Financial data submitted', { submissionId, tokenSymbol, assetType: token.asset_type });

    res.json({
      success:        true,
      submissionId,
      dataHash,
      status:         'PENDING',
      message:        'Data submitted for auditor review.',
      assetType:      token.asset_type,
      requiredFields: REQUIRED_FIELDS[token.asset_type?.toUpperCase()] || []
    });
  } catch (err) {
    logger.error('Data submission failed', { error: err.message });
    res.status(500).json({ error: 'Submission failed: ' + err.message });
  }
});

// GET /api/pipeline/submissions/:tokenSymbol
router.get('/submissions/:tokenSymbol', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT ds.*, t.token_symbol, t.token_name
      FROM data_submissions ds
      JOIN tokens t ON t.id = ds.token_id
      WHERE t.token_symbol = ?
      ORDER BY ds.created_at DESC
    `, [req.params.tokenSymbol.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch submissions' });
  }
});

// PUT /api/pipeline/approve/:submissionId — auditor approves and triggers valuation
router.put('/approve/:submissionId',
  authenticate,
  requireRole('ADMIN', 'AUDITOR'),
  async (req, res) => {
    const { auditorNotes } = req.body;

    try {
      const [submissions] = await db.execute(
        'SELECT * FROM data_submissions WHERE id = ?',
        [req.params.submissionId]
      );
      if (submissions.length === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      const sub = submissions[0];

      if (sub.status !== 'PENDING') {
        return res.status(400).json({ error: 'Submission already reviewed' });
      }

      const [tokens] = await db.execute(`
        SELECT t.*, s.asset_type, s.sector, s.id as spv_id
        FROM tokens t JOIN spvs s ON s.id = t.spv_id
        WHERE t.id = ?
      `, [sub.token_id]);

      if (tokens.length === 0) {
        return res.status(404).json({ error: 'Token not found' });
      }
      const token = tokens[0];

      await db.execute(`
        UPDATE data_submissions
        SET status = 'APPROVED', auditor_id = ?, auditor_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [req.user.userId, auditorNotes || '', req.params.submissionId]);

      const parsedData    = JSON.parse(sub.data_json);
      const financialData = parsedData.financialData || {};
      const issuedShares  = Number(token.issued_shares) || Number(token.authorised_shares) || 1;

      const valuationResult = calculateValuation(token.asset_type, {
        ...financialData,
        sector: token.sector
      });

      const blendedEV     = valuationResult.blended;
      const totalDebt     = Number(financialData.totalDebt) || 0;
      const cash          = Number(financialData.cash)      || 0;
      const equityValue   = blendedEV - totalDebt + cash;
      const pricePerToken = issuedShares > 0 ? equityValue / issuedShares : 1.00;

      const valuationId = uuidv4();
      try {
        await db.execute(`
          INSERT INTO valuations
            (id, token_id, spv_id, valuation_usd, price_per_token,
             method, revenue_ttm, ebitda_ttm, growth_rate_pct,
             discount_rate_pct, total_debt, cash, issued_shares,
             inputs_json, auditor_approved, auditor_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
          valuationId, token.id, token.spv_id,
          equityValue.toFixed(2), pricePerToken.toFixed(6),
          'AUDITOR_APPROVED_' + token.asset_type,
          financialData.revenueTTM      || null,
          financialData.ebitdaTTM       || null,
          financialData.growthRatePct   || null,
          financialData.discountRatePct || null,
          totalDebt, cash, issuedShares,
          JSON.stringify(valuationResult.models),
          req.user.userId
        ]);
      } catch (dbErr) {
        logger.warn('Could not save valuation record', { error: dbErr.message });
      }

      await db.execute(
        'UPDATE tokens SET current_price_usd = ? WHERE id = ?',
        [pricePerToken.toFixed(6), token.id]
      );

      const dataHash = parsedData.dataHash || null;
      try {
        await db.execute(`
          INSERT INTO oracle_prices
            (token_symbol, price, data_hash, set_by, source, status)
          VALUES (?, ?, ?, ?, 'AUDITOR_PIPELINE', 'APPROVED')
        `, [token.token_symbol, pricePerToken.toFixed(6), dataHash, req.user.userId]);
      } catch {}

      try {
        await db.execute(
          'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
          [
            'DATA_APPROVED_VALUATION_UPDATED', req.user.userId,
            token.token_symbol,
            JSON.stringify({ pricePerToken: pricePerToken.toFixed(6), equityValue: equityValue.toFixed(2), assetType: token.asset_type })
          ]
        );
      } catch {}

      logger.info('Data approved — valuation updated', {
        submissionId: req.params.submissionId,
        tokenSymbol:  token.token_symbol,
        pricePerToken: pricePerToken.toFixed(6)
      });

      res.json({
        success:       true,
        valuationId,
        tokenSymbol:   token.token_symbol,
        assetType:     token.asset_type,
        equityValue:   equityValue.toFixed(2),
        pricePerToken: pricePerToken.toFixed(6),
        issuedShares,
        models:        valuationResult.models,
        blended:       Math.round(blendedEV),
        message:       'Data approved. Valuation updated. Token price updated.'
      });
    } catch (err) {
      logger.error('Data approval failed', { error: err.message });
      res.status(500).json({ error: 'Approval failed: ' + err.message });
    }
  }
);

// PUT /api/pipeline/reject/:submissionId
router.put('/reject/:submissionId',
  authenticate,
  requireRole('ADMIN', 'AUDITOR'),
  async (req, res) => {
    const { auditorNotes } = req.body;
    try {
      await db.execute(`
        UPDATE data_submissions
        SET status = 'REJECTED', auditor_id = ?, auditor_notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [req.user.userId, auditorNotes || '', req.params.submissionId]);

      try {
        await db.execute(
          'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
          ['DATA_REJECTED', req.user.userId, req.params.submissionId, 'Submission rejected by auditor']
        );
      } catch {}

      res.json({ success: true, message: 'Submission rejected. Issuer can resubmit with corrected data.' });
    } catch (err) {
      res.status(500).json({ error: 'Could not reject submission' });
    }
  }
);

// GET /api/pipeline/schema/:assetType
router.get('/schema/:assetType', (req, res) => {
  const type = req.params.assetType.toUpperCase();

  const SCHEMAS = {
    EQUITY: {
      required: ['revenueTTM', 'growthRatePct'],
      optional: ['ebitdaTTM', 'freeCashFlow', 'totalDebt', 'cash', 'discountRatePct'],
      description: 'Equity company financial data',
      units: {
        revenueTTM:      'USD',
        ebitdaTTM:       'USD',
        freeCashFlow:    'USD',
        totalDebt:       'USD',
        cash:            'USD',
        growthRatePct:   'Percentage (e.g. 15 = 15%)',
        discountRatePct: 'Percentage (e.g. 12 = 12%)'
      }
    },
    REAL_ESTATE: {
      required: ['propertyValuation', 'totalDebt'],
      optional: ['cashAndEquivalents', 'netOperatingIncome', 'capRate', 'otherAssets', 'otherLiabilities'],
      description: 'Real estate asset financial data',
      units: {
        propertyValuation:  'USD — independent appraisal value',
        totalDebt:          'USD — mortgage and other secured debt',
        cashAndEquivalents: 'USD',
        netOperatingIncome: 'USD per year',
        capRate:            'Percentage (e.g. 7.5 = 7.5%)'
      }
    },
    MINING: {
      required: ['totalResourceTonnes', 'gradePercent', 'commodityPricePerTonne', 'miningCostPerTonne'],
      optional: ['recoveryRate', 'capitalCost', 'discountRate', 'mineLifeYears'],
      description: 'Mining and mineral resource data',
      units: {
        totalResourceTonnes:    'Metric tonnes of total resource',
        gradePercent:           'Percentage grade (e.g. 2.5 = 2.5%)',
        commodityPricePerTonne: 'USD per tonne of commodity',
        miningCostPerTonne:     'USD per tonne of ore mined',
        recoveryRate:           'Decimal (e.g. 0.85 = 85%)',
        capitalCost:            'USD — total capital expenditure',
        mineLifeYears:          'Years of expected mine life'
      }
    },
    INFRASTRUCTURE: {
      required: ['annualRevenue', 'operatingMarginPct'],
      optional: ['discountRate', 'contractYears', 'terminalGrowth'],
      description: 'Infrastructure asset data',
      units: {
        annualRevenue:      'USD per year',
        operatingMarginPct: 'Percentage (e.g. 45 = 45%)',
        discountRate:       'Decimal (e.g. 0.08 = 8%)',
        contractYears:      'Years remaining on concession/contract'
      }
    },
    REIT: {
      required: ['propertyValuation', 'netOperatingIncome'],
      optional: ['totalDebt', 'cashAndEquivalents', 'capRate'],
      description: 'REIT and property fund data',
      units: {
        propertyValuation:  'USD — total portfolio valuation',
        netOperatingIncome: 'USD per year',
        totalDebt:          'USD',
        capRate:            'Percentage'
      }
    },
    BOND: {
      required: ['faceValue', 'couponRatePct', 'marketYieldPct', 'periodsRemaining'],
      optional: ['periodsPerYear'],
      description: 'Bond instrument pricing data',
      units: {
        faceValue:        'USD — face/par value',
        couponRatePct:    'Percentage (e.g. 8 = 8% annual)',
        marketYieldPct:   'Percentage — current market yield',
        periodsRemaining: 'Number of coupon periods until maturity',
        periodsPerYear:   'Coupon payments per year (default 2)'
      }
    },
    OTHER: {
      required: ['revenueTTM'],
      optional: ['ebitdaTTM', 'freeCashFlow', 'totalDebt', 'cash'],
      description: 'General financial data',
      units: { revenueTTM: 'USD' }
    }
  };

  const schema = SCHEMAS[type];
  if (!schema) return res.status(404).json({ error: 'Unknown asset type' });
  res.json({ assetType: type, schema });
});

// GET /api/pipeline/history/:tokenSymbol
router.get('/history/:tokenSymbol', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT v.*,
             t.token_symbol, t.token_name, t.asset_type,
             s.legal_name as company_name
      FROM valuations v
      JOIN tokens t ON t.id = v.token_id
      JOIN spvs s   ON s.id = v.spv_id
      WHERE t.token_symbol = ?
      ORDER BY v.created_at DESC
      LIMIT 20
    `, [req.params.tokenSymbol.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

// POST /api/pipeline/preview
router.post('/preview', authenticate, async (req, res) => {
  const { tokenSymbol, financialData } = req.body;
  if (!tokenSymbol || !financialData) {
    return res.status(400).json({ error: 'tokenSymbol and financialData required' });
  }
  try {
    const [tokens] = await db.execute(`
      SELECT t.*, s.asset_type, s.sector
      FROM tokens t JOIN spvs s ON s.id = t.spv_id
      WHERE t.token_symbol = ?
    `, [tokenSymbol.toUpperCase()]);

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    const token = tokens[0];

    const result        = calculateValuation(token.asset_type, { ...financialData, sector: token.sector });
    const issuedShares  = Number(token.issued_shares) || Number(token.authorised_shares) || 1;
    const totalDebt     = Number(financialData.totalDebt) || 0;
    const cash          = Number(financialData.cash) || 0;
    const equityValue   = result.blended - totalDebt + cash;
    const pricePerToken = issuedShares > 0 ? equityValue / issuedShares : 0;

    res.json({
      tokenSymbol:   token.token_symbol,
      assetType:     token.asset_type,
      equityValue:   equityValue.toFixed(2),
      pricePerToken: pricePerToken.toFixed(6),
      issuedShares,
      models:        result.models,
      blended:       Math.round(result.blended),
      preview:       true,
      note:          'This is a preview only. Submit data for auditor approval to update the official price.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Preview failed: ' + err.message });
  }
});

module.exports = router;