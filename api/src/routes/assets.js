const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }        = require('../middleware/auth');
const { requireRole, requireKYC } = require('../middleware/roles');
const { v4: uuidv4 }          = require('uuid');

// POST /api/assets/register — register SPV and deploy token
router.post('/register', authenticate, requireKYC, async (req, res) => {
  const {
    legalName, registrationNumber, jurisdiction, sector,
    assetType, description, ipfsDocHash, tokenName,
    tokenSymbol, ticker, authorisedShares, nominalValueCents
  } = req.body;

  if (!legalName || !registrationNumber || !tokenSymbol) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM spvs WHERE registration_number = ?',
      [registrationNumber]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Registration number already exists' });
    }

    const [existingToken] = await db.execute(
      'SELECT id FROM tokens WHERE token_symbol = ?',
      [tokenSymbol.toUpperCase()]
    );
    if (existingToken.length > 0) {
      return res.status(409).json({ error: 'Token symbol already taken' });
    }

    const [spvResult] = await db.execute(`
      INSERT INTO spvs
        (owner_user_id, legal_name, registration_no, registration_number,
         jurisdiction, sector, asset_type, description, ipfs_doc_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      req.user.userId, legalName, registrationNumber, registrationNumber,
      jurisdiction || 'Zimbabwe', sector || 'OTHER', assetType || 'EQUITY', description || null, ipfsDocHash || null
    ]);
    const spvId = spvResult[0].id;

    const [tokenResult] = await db.execute(`
      INSERT INTO tokens
        (spv_id, symbol, name, company_name, token_name, token_symbol, ticker,
         asset_type, asset_class, authorised_shares, issued_shares, nominal_value_cents,
         total_supply, price_usd, current_price_usd, oracle_price,
         market_state, status, jurisdiction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRE_LAUNCH', 'DRAFT', ?)
      RETURNING id
    `, [
      spvId,
      tokenSymbol.toUpperCase(),
      tokenName,
      legalName,
      tokenName,
      tokenSymbol.toUpperCase(),
      (ticker || tokenSymbol).toUpperCase(),
      assetType || 'EQUITY',
      assetType || 'EQUITY',
      parseInt(authorisedShares) || 1000000,
      parseInt(authorisedShares) || 1000000,
      parseInt(nominalValueCents) || 100,
      parseInt(authorisedShares) || 1000000,
      (parseInt(nominalValueCents) || 100) / 100,
      (parseInt(nominalValueCents) || 100) / 100,
      (parseInt(nominalValueCents) || 100) / 100,
      jurisdiction || 'Zimbabwe'
    ]);
    const tokenId = tokenResult[0].id;

    await db.execute(
      'UPDATE users SET role = ? WHERE id = ? AND role = ?',
      ['ISSUER', req.user.userId, 'INVESTOR']
    );

    await db.execute(
      'INSERT INTO audit_logs (action, performed_by, target_entity, details) VALUES (?, ?, ?, ?)',
       [`ASSET_REGISTERED`, req.user.userId, tokenSymbol.toUpperCase(), `SPV: ${legalName}, Token: ${tokenName}`]
    );

    logger.info('Asset registered', { spvId, tokenId, symbol: tokenSymbol });

    res.json({
      success:     true,
      spvId,
      tokenId,
      tokenSymbol: tokenSymbol.toUpperCase(),
      message:     'Asset registered. Pending compliance review.'
    });
  } catch (err) {
    logger.error('Asset registration failed', { error: err.message });
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// GET /api/assets/my — get assets owned by current user
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT t.*, s.legal_name, s.registration_number,
             s.jurisdiction, s.sector, s.asset_type as spv_asset_type,
             s.ipfs_doc_hash as spv_ipfs_hash
      FROM tokens t
      JOIN spvs s ON s.id = t.spv_id
      WHERE s.owner_user_id = ?
      ORDER BY t.created_at DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch assets' });
  }
});

// GET /api/assets/all — list all active assets (public)
router.get('/all', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT t.id, t.token_name, t.token_symbol, t.ticker,
             t.asset_type, t.current_price_usd, t.market_state,
             t.issued_shares, t.authorised_shares, t.status,
             s.legal_name, s.jurisdiction, s.sector
      FROM tokens t
      JOIN spvs s ON s.id = t.spv_id
      WHERE t.status IN ('ACTIVE', 'DRAFT')
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch assets' });
  }
});

// GET /api/assets/:tokenSymbol — get asset details
router.get('/:tokenSymbol', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT t.*, s.legal_name, s.registration_number,
             s.jurisdiction, s.sector, s.description,
             s.ipfs_doc_hash as spv_ipfs_hash,
             u.wallet_address as issuer_wallet
      FROM tokens t
      JOIN spvs s ON s.id = t.spv_id
      JOIN users u ON u.id = s.owner_user_id
      WHERE t.token_symbol = ?
    `, [req.params.tokenSymbol.toUpperCase()]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch asset' });
  }
});

// PUT /api/assets/:tokenId/activate — admin activates an asset
router.put('/:tokenId/activate',
  authenticate,
  requireRole('ADMIN', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    try {
      await db.execute(
        "UPDATE tokens SET status = 'ACTIVE', market_state = 'P2P_ONLY' WHERE id = ?",
        [req.params.tokenId]
      );
      res.json({ success: true, message: 'Asset activated' });
    } catch (err) {
      res.status(500).json({ error: 'Could not activate asset' });
    }
  }
);

// PUT /api/assets/:tokenId/market-state — update market state
router.put('/:tokenId/market-state',
  authenticate,
  requireRole('ADMIN', 'COMPLIANCE_OFFICER'),
  async (req, res) => {
    const { marketState } = req.body;
    const valid = ['PRE_LAUNCH','P2P_ONLY','LIMITED_TRADING','FULL_TRADING','HALTED'];
    if (!valid.includes(marketState)) {
      return res.status(400).json({ error: 'Invalid market state' });
    }
    try {
      await db.execute(
        'UPDATE tokens SET market_state = ? WHERE id = ?',
        [marketState, req.params.tokenId]
      );
      res.json({ success: true, marketState });
    } catch (err) {
      res.status(500).json({ error: 'Could not update market state' });
    }
  }
);


// GET /api/assets  ← alias for dashboard
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT t.id, t.token_name, t.token_symbol, t.ticker,
             t.asset_type, t.current_price_usd, t.market_state,
             t.issued_shares, t.authorised_shares, t.status,
             s.legal_name as company_name, s.jurisdiction, s.sector
      FROM tokens t
      JOIN spvs s ON s.id = t.spv_id
      WHERE t.status IN ('ACTIVE','DRAFT')
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Could not fetch assets' }); }
});

module.exports = router;