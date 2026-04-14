const router = require('express').Router();
const db     = require('../db/pool');
const logger = require('../utils/logger');
const { authenticate }         = require('../middleware/auth');
const { requireKYC }           = require('../middleware/roles');
const { v4: uuidv4 }           = require('uuid');
const { calculateValuation }   = require('../services/valuation');

// POST /api/valuation/calculate
router.post('/calculate', authenticate, requireKYC, async (req, res) => {
  const {
    tokenSymbol, revenueTTM, ebitdaTTM, freeCashFlow,
    growthRatePct, discountRatePct, totalDebt, cash,
    totalAssets, totalLiabilities,
    propertyValuation, netOperatingIncome, capRate,
    totalResourceTonnes, gradePercent, commodityPricePerTonne,
    recoveryRate, miningCostPerTonne, capitalCost, mineLifeYears,
    faceValue, couponRatePct, marketYieldPct, periodsRemaining, periodsPerYear,
    annualRevenue, operatingMarginPct, contractYears, terminalGrowth
  } = req.body;

  if (!tokenSymbol) {
    return res.status(400).json({ error: 'tokenSymbol is required' });
  }

  try {
    // Fetch token — try both symbol column names
    const [tokens] = await db.execute(`
      SELECT t.*, t.asset_class as asset_type
      FROM tokens t
      WHERE t.symbol = ? OR t.token_symbol = ?
      LIMIT 1
    `, [tokenSymbol.toUpperCase(), tokenSymbol.toUpperCase()]);

    const token        = tokens[0] || null;
    const assetType    = token?.asset_type || token?.asset_class || 'EQUITY';
    const sector       = token?.sector || 'DEFAULT';
    const issuedShares = Number(token?.total_supply) || Number(token?.issued_shares) || Number(token?.authorised_shares) || 1000000;
    const growthRate   = (Number(growthRatePct)   || 15) / 100;
    const discountRate = (Number(discountRatePct) || 12) / 100;

    const valuationData = {
      revenueTTM:           Number(revenueTTM)            || 0,
      ebitdaTTM:            Number(ebitdaTTM)             || 0,
      freeCashFlow:         Number(freeCashFlow)           || (Number(revenueTTM) * 0.15) || 0,
      growthRate,
      discountRate,
      sector,
      totalDebt:            Number(totalDebt)              || 0,
      cashAndEquivalents:   Number(cash)                   || 0,
      totalAssets:          Number(totalAssets)            || 0,
      totalLiabilities:     Number(totalLiabilities)       || 0,
      propertyValuation:    Number(propertyValuation)      || 0,
      netOperatingIncome:   Number(netOperatingIncome)     || 0,
      capRate:              Number(capRate)                || 0,
      totalResourceTonnes:  Number(totalResourceTonnes)   || 0,
      gradePercent:         Number(gradePercent)           || 0,
      commodityPricePerTonne: Number(commodityPricePerTonne) || 0,
      recoveryRate:         Number(recoveryRate)           || 0.85,
      miningCostPerTonne:   Number(miningCostPerTonne)    || 0,
      capitalCost:          Number(capitalCost)            || 0,
      mineLifeYears:        Number(mineLifeYears)          || 10,
      faceValue:            Number(faceValue)              || 0,
      couponRatePct:        Number(couponRatePct)          || 0,
      marketYieldPct:       Number(marketYieldPct)         || 0,
      periodsRemaining:     Number(periodsRemaining)       || 0,
      periodsPerYear:       Number(periodsPerYear)         || 2,
      annualRevenue:        Number(annualRevenue)          || Number(revenueTTM) || 0,
      operatingMarginPct:   Number(operatingMarginPct)    || 40,
      contractYears:        Number(contractYears)          || 20,
      terminalGrowth:       Number(terminalGrowth)         || 0.02,
    };

    // Run the full asset-class aware service
    const result      = calculateValuation(assetType, valuationData);
    const blendedEV   = result.blended || 0;
    const equityValue = blendedEV - (Number(totalDebt) || 0) + (Number(cash) || 0);
    const pricePerToken = issuedShares > 0 ? equityValue / issuedShares : 1.00;

    // Persist if token exists
    if (token) {
      const valuationId = uuidv4();
      try {
        await db.execute(`
          INSERT INTO valuations
            (id, token_id, valuation_usd, price_per_token,
             method, revenue_ttm, ebitda_ttm, free_cash_flow,
             growth_rate_pct, discount_rate_pct, total_debt, cash,
             issued_shares, inputs_json)
          VALUES (?, ?, ?, ?, 'BLENDED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          valuationId, token.id,
          equityValue.toFixed(2), pricePerToken.toFixed(6),
          revenueTTM || 0, ebitdaTTM || null, freeCashFlow || null,
          growthRatePct || 15, discountRatePct || 12,
          totalDebt || 0, cash || 0, issuedShares,
          JSON.stringify(result.models)
        ]);
      } catch (dbErr) {
        logger.warn('Could not save valuation record', { error: dbErr.message });
      }

      try {
        await db.execute(
          'UPDATE tokens SET current_price_usd = ? WHERE id = ?',
          [pricePerToken.toFixed(6), token.id]
        );
      } catch {}
    }

    logger.info('Valuation calculated', { tokenSymbol, assetType, blendedEV });

    res.json({
      success:       true,
      tokenSymbol:   tokenSymbol.toUpperCase(),
      assetType,
      equityValue:   equityValue.toFixed(2),
      pricePerToken: pricePerToken.toFixed(6),
      issuedShares,
      models:        result.models,
      blended:       Math.round(blendedEV),
    });

  } catch (err) {
    logger.error('Valuation failed', { error: err.message });
    res.status(500).json({ error: 'Valuation failed: ' + err.message });
  }
});

// GET /api/valuation/history/:tokenSymbol
router.get('/history/:tokenSymbol', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT v.*, t.symbol as token_symbol
      FROM valuations v
      JOIN tokens t ON t.id = v.token_id
      WHERE t.symbol = ? OR t.token_symbol = ?
      ORDER BY v.created_at DESC
      LIMIT 10
    `, [req.params.tokenSymbol.toUpperCase(), req.params.tokenSymbol.toUpperCase()]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch valuation history' });
  }
});

module.exports = router;
