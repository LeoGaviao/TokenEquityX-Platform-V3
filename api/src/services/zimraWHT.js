'use strict';

// ── Quarter helper ─────────────────────────────────────────────────────────────
function getQuarterDetails(date = new Date()) {
  const month = date.getMonth(); // 0-indexed
  const year  = date.getFullYear();

  let quarter, startMonth, endMonth;
  if      (month <= 2) { quarter = 'Q1'; startMonth = 0; endMonth = 2; }
  else if (month <= 5) { quarter = 'Q2'; startMonth = 3; endMonth = 5; }
  else if (month <= 8) { quarter = 'Q3'; startMonth = 6; endMonth = 8; }
  else                 { quarter = 'Q4'; startMonth = 9; endMonth = 11; }

  const periodStart = new Date(year, startMonth, 1);
  const periodEnd   = new Date(year, endMonth + 1, 0); // last day of end month

  // Due date: 10th of the month following quarter end
  // Q4: due 10 January of the following year
  let dueYear  = year;
  let dueMonth = endMonth + 1; // still 0-indexed
  if (quarter === 'Q4') { dueYear = year + 1; dueMonth = 0; }
  const dueDate = new Date(dueYear, dueMonth, 10);

  return {
    quarter:     `${quarter}-${year}`,
    taxYear:     year,
    periodStart,
    periodEnd,
    dueDate,
    label: `${quarter} ${year} (${periodStart.toLocaleDateString('en-ZA')} — ${periodEnd.toLocaleDateString('en-ZA')})`
  };
}

// ── Parse a quarter label back to period dates ─────────────────────────────────
function parseQuarterLabel(quarterLabel) {
  const [q, yearStr] = quarterLabel.split('-');
  const year         = parseInt(yearStr, 10);
  const quarterNum   = parseInt(q.replace('Q', ''), 10);
  const startMonth   = (quarterNum - 1) * 3;
  const periodStart  = new Date(year, startMonth, 1);
  const periodEnd    = new Date(year, startMonth + 3, 0);
  return { periodStart, periodEnd, year };
}

// ── Generate structured WHT return data for a quarter ─────────────────────────
// Uses dividend_claims column names: withholding_rate, withholding_tax, claimed_at, user_id
async function generateWHTReturn(db, quarterLabel) {
  const { periodStart, periodEnd } = parseQuarterLabel(quarterLabel);

  const [rows] = await db.execute(`
    SELECT
      dc.id                    AS claim_id,
      u.full_name              AS investor_name,
      u.email                  AS investor_email,
      k.national_id,
      k.passport_number,
      k.nationality,
      k.country_of_residence,
      dc.gross_amount,
      dc.withholding_rate      AS wht_rate,
      dc.withholding_tax       AS wht_amount,
      dc.net_amount,
      dc.claimed_at            AS paid_at,
      dc.token_symbol,
      dr.round_type            AS distribution_type
    FROM dividend_claims dc
    JOIN   users        u  ON u.id       = dc.user_id
    LEFT JOIN kyc_records k  ON k.user_id = dc.user_id
    JOIN   dividend_rounds dr ON dr.id   = dc.round_id
    WHERE dc.claimed_at BETWEEN ? AND ?
      AND dc.claimed        = TRUE
      AND dc.withholding_tax > 0
    ORDER BY dc.claimed_at, u.full_name
  `, [periodStart, periodEnd]);

  const totals = rows.reduce((acc, row) => {
    const res = (row.country_of_residence || row.nationality || '').toUpperCase() === 'ZW';
    acc.totalGross      += parseFloat(row.gross_amount || 0);
    acc.totalWHT        += parseFloat(row.wht_amount   || 0);
    acc.totalNet        += parseFloat(row.net_amount   || 0);
    if (res) acc.residentWHT    += parseFloat(row.wht_amount || 0);
    else     acc.nonResidentWHT += parseFloat(row.wht_amount || 0);
    return acc;
  }, { totalGross: 0, totalWHT: 0, totalNet: 0, residentWHT: 0, nonResidentWHT: 0 });

  return {
    quarter:           quarterLabel,
    periodStart:       periodStart.toISOString().split('T')[0],
    periodEnd:         periodEnd.toISOString().split('T')[0],
    platform:          'TokenEquityX (Private) Limited',
    taxType:           'Withholding Tax on Dividends / Distributions',
    currency:          'USD',
    totals,
    distributionCount: rows.length,
    investorCount:     new Set(rows.map(r => r.investor_email)).size,
    lineItems: rows.map(row => ({
      investorName:     row.investor_name,
      investorEmail:    row.investor_email,
      nationalId:       row.national_id || row.passport_number || 'N/A',
      residency:        row.country_of_residence || row.nationality || 'Unknown',
      tokenName:        row.token_symbol,
      tokenSymbol:      row.token_symbol,
      grossAmount:      parseFloat(row.gross_amount),
      whtRate:          (parseFloat(row.wht_rate) * 100).toFixed(0) + '%',
      whtAmount:        parseFloat(row.wht_amount),
      netAmount:        parseFloat(row.net_amount),
      paymentDate:      row.paid_at ? new Date(row.paid_at).toISOString().split('T')[0] : null,
      distributionType: row.distribution_type || 'DIVIDEND',
    })),
  };
}

// ── Generate ZIMRA-ready CSV ───────────────────────────────────────────────────
function generateWHTCSV(whtReturn) {
  const headers = [
    'Investor Name',
    'Email',
    'National ID / Passport',
    'Residency',
    'Token / Asset',
    'Distribution Type',
    'Gross Amount (USD)',
    'WHT Rate',
    'WHT Deducted (USD)',
    'Net Paid (USD)',
    'Payment Date',
  ].join(',');

  const rows = whtReturn.lineItems.map(item => [
    `"${String(item.investorName || '').replace(/"/g, '""')}"`,
    `"${item.investorEmail}"`,
    `"${item.nationalId}"`,
    `"${item.residency}"`,
    `"${item.tokenName} (${item.tokenSymbol})"`,
    `"${item.distributionType}"`,
    item.grossAmount.toFixed(2),
    `"${item.whtRate}"`,
    item.whtAmount.toFixed(2),
    item.netAmount.toFixed(2),
    `"${item.paymentDate || ''}"`,
  ].join(','));

  return [headers, ...rows].join('\n');
}

// ── Aggregate distinct quarters that have WHT data in dividend_claims ──────────
async function listWHTQuarters(db) {
  // Get all quarters with dividend claims
  const [claimRows] = await db.execute(`
    SELECT
      EXTRACT(YEAR  FROM claimed_at)::int AS tax_year,
      CASE
        WHEN EXTRACT(MONTH FROM claimed_at) BETWEEN 1 AND 3 THEN 'Q1'
        WHEN EXTRACT(MONTH FROM claimed_at) BETWEEN 4 AND 6 THEN 'Q2'
        WHEN EXTRACT(MONTH FROM claimed_at) BETWEEN 7 AND 9 THEN 'Q3'
        ELSE 'Q4'
      END AS q,
      SUM(withholding_tax)  AS total_wht,
      COUNT(*)              AS distribution_count
    FROM dividend_claims
    WHERE claimed = TRUE AND withholding_tax > 0
    GROUP BY tax_year, q
    ORDER BY tax_year DESC, q DESC
  `);

  // Get all remittance records
  const [remRows] = await db.execute(
    'SELECT * FROM zimra_remittances ORDER BY tax_year DESC, quarter DESC'
  );
  const remByQuarter = {};
  remRows.forEach(r => { remByQuarter[r.quarter] = r; });

  return claimRows.map(row => {
    const label   = `${row.q}-${row.tax_year}`;
    const details = getQuarterDetails(new Date(parseInt(row.tax_year), (parseInt(row.q.replace('Q','')) - 1) * 3, 15));
    const rem     = remByQuarter[label] || null;
    return {
      quarter:           label,
      taxYear:           row.tax_year,
      periodStart:       details.periodStart.toISOString().split('T')[0],
      periodEnd:         details.periodEnd.toISOString().split('T')[0],
      dueDate:           details.dueDate.toISOString().split('T')[0],
      totalWHT:          parseFloat(row.total_wht),
      distributionCount: parseInt(row.distribution_count),
      // Remittance record fields (null if not yet created)
      status:            rem?.status     || 'PENDING',
      zimraReference:    rem?.zimra_reference || null,
      paymentDate:       rem?.payment_date    || null,
      bankReference:     rem?.bank_reference  || null,
      reportSentAt:      rem?.report_sent_at  || null,
      remittanceId:      rem?.id              || null,
    };
  });
}

module.exports = { getQuarterDetails, generateWHTReturn, generateWHTCSV, listWHTQuarters };
