const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { v4: uuidv4 }   = require('uuid');
const { calculateValuation } = require('../services/valuation');
const { generateDataHash }   = require('../services/dataHash');

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
        ds.admin_notes, ds.audit_report, ds.assigned_auditor, ds.data_json
      FROM data_submissions ds
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

module.exports = router;
