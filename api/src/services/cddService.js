// api/src/services/cddService.js
// Customer Due Diligence — SI 99 of 2026, Section 21
// Money Laundering and Proceeds of Crime (VASP Registration) Regulations, 2026
// Administered by the Financial Intelligence Unit (FIU), Reserve Bank of Zimbabwe.
//
// Section 21(1): CDD required for all transactions >= USD 1,000
// Section 21(5): Suspicious activity must be reported to the FIU via STR

const CDD_THRESHOLD_USD  = 1000;
const REGULATORY_BASIS   = 'SI 99 of 2026, Section 21 — CDD obligation >= USD 1,000';

async function triggerCDDIfRequired(db, params) {
  const { userId, transactionId, transactionType, amountUsd } = params;

  if (amountUsd < CDD_THRESHOLD_USD) {
    return { required: false, cddId: null };
  }

  // Initial risk score: higher amounts = higher starting score (capped at 50 from amount alone)
  const riskScore = Math.min(50, Math.round((amountUsd / 10000) * 50));

  const [rows] = await db.execute(
    `INSERT INTO cdd_checks (
       user_id, transaction_id, transaction_type,
       amount_usd, risk_score, regulatory_basis
     ) VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      userId, transactionId || null, transactionType,
      amountUsd, riskScore, REGULATORY_BASIS,
    ]
  );

  const cddId = rows[0]?.id || null;
  return { required: true, cddId };
}

async function clearCDDCheck(db, cddId, reviewerId, notes) {
  await db.execute(
    `UPDATE cdd_checks
     SET cdd_status  = 'CLEARED',
         reviewer_id = ?,
         reviewed_at = NOW(),
         notes       = ?
     WHERE id = ?`,
    [reviewerId, notes || null, cddId]
  );
}

async function flagCDDCheck(db, cddId, reviewerId, notes) {
  await db.execute(
    `UPDATE cdd_checks
     SET cdd_status  = 'FLAGGED',
         reviewer_id = ?,
         reviewed_at = NOW(),
         notes       = ?
     WHERE id = ?`,
    [reviewerId, notes || null, cddId]
  );
}

module.exports = { triggerCDDIfRequired, clearCDDCheck, flagCDDCheck, CDD_THRESHOLD_USD };
