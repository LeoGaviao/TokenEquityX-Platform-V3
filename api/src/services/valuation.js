/**
 * TokenEquityX V2 — Enhanced Valuation Engine
 * Supports: Equity, Real Estate, Mining, Infrastructure, REIT, Bond
 */

// ─── EQUITY MODELS ────────────────────────────────────────────────

function revenueMultiple({ revenueTTM, sector }) {
  const MULTIPLES = {
    TECH:           10,
    FINTECH:        14,
    AGRICULTURE:     5,
    MANUFACTURING:   4,
    RETAIL:          3,
    MINING:          6,
    REAL_ESTATE:     8,
    INFRASTRUCTURE:  7,
    HEALTHCARE:      9,
    EDUCATION:       6,
    LOGISTICS:       5,
    DEFAULT:         6
  };
  const multiple = MULTIPLES[sector?.toUpperCase()] || MULTIPLES.DEFAULT;
  return {
    enterpriseValue: revenueTTM * multiple,
    multiple,
    method: 'REVENUE_MULTIPLE'
  };
}

function ebitdaMultiple({ ebitdaTTM, sector }) {
  const MULTIPLES = {
    TECH:           18,
    FINTECH:        22,
    AGRICULTURE:     8,
    MANUFACTURING:   7,
    RETAIL:          6,
    MINING:         10,
    REAL_ESTATE:    12,
    INFRASTRUCTURE: 11,
    HEALTHCARE:     14,
    DEFAULT:         9
  };
  const multiple = MULTIPLES[sector?.toUpperCase()] || MULTIPLES.DEFAULT;
  return {
    enterpriseValue: ebitdaTTM * multiple,
    multiple,
    method: 'EBITDA_MULTIPLE'
  };
}

function dcf({
  freeCashFlow,
  growthRate,
  discountRate,
  terminalGrowth = 0.03,
  years = 5
}) {
  if (discountRate <= terminalGrowth) {
    discountRate = terminalGrowth + 0.01;
  }

  let totalPV = 0;
  let fcf     = freeCashFlow;
  const projections = [];

  for (let y = 1; y <= years; y++) {
    fcf = fcf * (1 + growthRate);
    const pv = fcf / Math.pow(1 + discountRate, y);
    projections.push({
      year: y,
      fcf:  Math.round(fcf),
      pv:   Math.round(pv)
    });
    totalPV += pv;
  }

  const terminalFCF    = fcf * (1 + terminalGrowth);
  const terminalValue  = terminalFCF / (discountRate - terminalGrowth);
  const pvTerminal     = terminalValue / Math.pow(1 + discountRate, years);
  const enterpriseValue = totalPV + pvTerminal;

  return {
    enterpriseValue:  Math.round(enterpriseValue),
    pvCashFlows:      Math.round(totalPV),
    pvTerminalValue:  Math.round(pvTerminal),
    projections,
    method: 'DCF'
  };
}

// ─── REAL ESTATE MODEL ────────────────────────────────────────────

function realEstateNAV({
  propertyValuation,
  totalDebt,
  cashAndEquivalents,
  otherAssets = 0,
  otherLiabilities = 0
}) {
  const grossAssets   = propertyValuation + cashAndEquivalents + otherAssets;
  const totalLiab     = totalDebt + otherLiabilities;
  const nav           = grossAssets - totalLiab;

  return {
    nav,
    grossAssets,
    totalLiabilities: totalLiab,
    loanToValue:      totalDebt > 0
      ? ((totalDebt / propertyValuation) * 100).toFixed(2)
      : 0,
    method: 'REAL_ESTATE_NAV'
  };
}

function capRateValuation({ netOperatingIncome, capRate }) {
  if (!capRate || capRate <= 0) return null;
  const value = netOperatingIncome / (capRate / 100);
  return {
    enterpriseValue: Math.round(value),
    capRate,
    netOperatingIncome,
    method: 'CAP_RATE'
  };
}

// ─── MINING / RESOURCE MODEL ──────────────────────────────────────

function resourceValuation({
  totalResourceTonnes,
  gradePercent,
  commodityPricePerTonne,
  recoveryRate = 0.85,
  miningCostPerTonne,
  capitalCost = 0,
  discountRate = 0.10,
  mineLifeYears = 10
}) {
  // Calculate contained metal
  const containedMetal    = totalResourceTonnes * (gradePercent / 100);
  const recoverableMetal  = containedMetal * recoveryRate;

  // Annual production (simplified: evenly spread)
  const annualProduction  = recoverableMetal / mineLifeYears;

  // Annual revenue and costs
  const annualRevenue     = annualProduction * commodityPricePerTonne;
  const annualCosts       = totalResourceTonnes / mineLifeYears * miningCostPerTonne;
  const annualCashFlow    = annualRevenue - annualCosts;

  // DCF of mine cash flows
  let totalPV = 0;
  const cashFlows = [];
  for (let y = 1; y <= mineLifeYears; y++) {
    const pv = annualCashFlow / Math.pow(1 + discountRate, y);
    totalPV += pv;
    cashFlows.push({ year: y, cashFlow: Math.round(annualCashFlow), pv: Math.round(pv) });
  }

  const npv = totalPV - capitalCost;

  return {
    enterpriseValue:  Math.round(Math.max(npv, 0)),
    containedMetal:   Math.round(containedMetal),
    recoverableMetal: Math.round(recoverableMetal),
    annualProduction: Math.round(annualProduction),
    npv:              Math.round(npv),
    cashFlows,
    method: 'RESOURCE_VALUATION'
  };
}

// ─── BOND PRICING MODEL ───────────────────────────────────────────

function bondPricing({
  faceValue,
  couponRatePct,
  marketYieldPct,
  periodsRemaining,
  periodsPerYear = 2
}) {
  const couponPayment   = (faceValue * (couponRatePct / 100)) / periodsPerYear;
  const periodYield     = (marketYieldPct / 100) / periodsPerYear;

  // Price = PV of coupons + PV of face value
  let pvCoupons = 0;
  for (let t = 1; t <= periodsRemaining; t++) {
    pvCoupons += couponPayment / Math.pow(1 + periodYield, t);
  }
  const pvFaceValue = faceValue / Math.pow(1 + periodYield, periodsRemaining);
  const price       = pvCoupons + pvFaceValue;

  // Duration (Macaulay)
  let weightedTime = 0;
  for (let t = 1; t <= periodsRemaining; t++) {
    const pv = couponPayment / Math.pow(1 + periodYield, t);
    weightedTime += (t / periodsPerYear) * (pv / price);
  }
  weightedTime += (periodsRemaining / periodsPerYear) * (pvFaceValue / price);

  return {
    price:              Math.round(price * 100) / 100,
    pvCoupons:          Math.round(pvCoupons * 100) / 100,
    pvFaceValue:        Math.round(pvFaceValue * 100) / 100,
    macaulayDuration:   Math.round(weightedTime * 100) / 100,
    premiumDiscount:    ((price - faceValue) / faceValue * 100).toFixed(2),
    method: 'BOND_PRICING'
  };
}

// ─── INFRASTRUCTURE / REIT MODEL ─────────────────────────────────

function infrastructureValuation({
  annualRevenue,
  operatingMarginPct,
  discountRate = 0.08,
  contractYears = 20,
  terminalGrowth = 0.02
}) {
  const annualCashFlow  = annualRevenue * (operatingMarginPct / 100);
  const growthRate      = 0.03; // infrastructure typically grows with inflation

  let totalPV = 0;
  let cf      = annualCashFlow;
  const cashFlows = [];

  for (let y = 1; y <= contractYears; y++) {
    cf = cf * (1 + growthRate);
    const pv = cf / Math.pow(1 + discountRate, y);
    totalPV += pv;
    cashFlows.push({ year: y, cashFlow: Math.round(cf), pv: Math.round(pv) });
  }

  const terminalCF    = cf * (1 + terminalGrowth);
  const terminalValue = terminalCF / (discountRate - terminalGrowth);
  const pvTerminal    = terminalValue / Math.pow(1 + discountRate, contractYears);

  return {
    enterpriseValue: Math.round(totalPV + pvTerminal),
    pvContractCashFlows: Math.round(totalPV),
    pvTerminalValue:     Math.round(pvTerminal),
    cashFlows,
    method: 'INFRASTRUCTURE_DCF'
  };
}

// ─── BLENDED VALUATION ────────────────────────────────────────────

function blendModels(models) {
  const values = models
    .filter(m => m && m.enterpriseValue > 0)
    .map(m => m.enterpriseValue);

  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ─── MAIN VALUATION DISPATCHER ────────────────────────────────────

function calculateValuation(assetType, data) {
  const type = assetType?.toUpperCase();

  if (type === 'EQUITY' || type === 'OTHER') {
    const rm  = data.revenueTTM  ? revenueMultiple({ revenueTTM: data.revenueTTM, sector: data.sector }) : null;
    const eb  = data.ebitdaTTM   ? ebitdaMultiple({ ebitdaTTM: data.ebitdaTTM, sector: data.sector }) : null;
    const dcfResult = data.freeCashFlow ? dcf({
      freeCashFlow: data.freeCashFlow,
      growthRate:   (data.growthRatePct || 15) / 100,
      discountRate: (data.discountRatePct || 12) / 100
    }) : null;

    const blended = blendModels([rm, eb, dcfResult].filter(Boolean));

    return {
      models:   { revenueMultiple: rm, ebitdaMultiple: eb, dcf: dcfResult },
      blended,
      assetType: type
    };
  }

  if (type === 'REAL_ESTATE' || type === 'REIT') {
    const nav = data.propertyValuation
      ? realEstateNAV(data)
      : null;
    const cap = data.netOperatingIncome && data.capRate
      ? capRateValuation({ netOperatingIncome: data.netOperatingIncome, capRate: data.capRate })
      : null;

    const blended = blendModels([nav, cap].filter(Boolean));

    return {
      models:   { nav, capRate: cap },
      blended,
      assetType: type
    };
  }

  if (type === 'MINING') {
    const resource = data.totalResourceTonnes
      ? resourceValuation(data)
      : null;
    const rm = data.revenueTTM
      ? revenueMultiple({ revenueTTM: data.revenueTTM, sector: 'MINING' })
      : null;

    const blended = blendModels([resource, rm].filter(Boolean));

    return {
      models:   { resourceValuation: resource, revenueMultiple: rm },
      blended,
      assetType: type
    };
  }

  if (type === 'INFRASTRUCTURE') {
    const infra = data.annualRevenue
      ? infrastructureValuation(data)
      : null;

    return {
      models:   { infrastructure: infra },
      blended:  infra?.enterpriseValue || 0,
      assetType: type
    };
  }

  if (type === 'BOND') {
    const bond = data.faceValue
      ? bondPricing(data)
      : null;

    return {
      models:   { bondPricing: bond },
      blended:  bond?.price || 0,
      assetType: type
    };
  }

  // Default — use whatever data is available
  const rm = data.revenueTTM
    ? revenueMultiple({ revenueTTM: data.revenueTTM, sector: data.sector })
    : null;

  return {
    models:  { revenueMultiple: rm },
    blended: rm?.enterpriseValue || 0,
    assetType: type
  };
}

module.exports = {
  calculateValuation,
  revenueMultiple,
  ebitdaMultiple,
  dcf,
  realEstateNAV,
  capRateValuation,
  resourceValuation,
  bondPricing,
  infrastructureValuation,
  blendModels
};