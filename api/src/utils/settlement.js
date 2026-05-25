const { v4: uuidv4 } = require('uuid');

// createSettlementInstruction — write a row to settlement_instructions so the
// banking partner dashboard can see and process every platform funds movement.
//
// Maps conceptual parameters to the actual settlement_instructions columns:
//   from_user_id → investor_id (payer / first party)
//   to_user_id   → issuer_id   (payee / second party)
//   gross_amount → amount_usd
//   fee_amount   → fee_usd
//   net_amount   → net_amount_usd
//
// Requires settlement_instructions to have settlement_rail and metadata columns
// (added via the /api/setup/migrate migration).
async function createSettlementInstruction(db, {
  type,
  token_symbol    = null,
  from_user_id    = null,
  to_user_id      = null,
  gross_amount,
  fee_amount      = 0,
  net_amount,
  settlement_rail = 'FIAT',
  reference,
  metadata        = null,
}) {
  const id = uuidv4();
  await db.execute(`
    INSERT INTO settlement_instructions
      (id, type, reference, token_symbol,
       investor_id, issuer_id,
       amount_usd, fee_usd, wht_usd, net_amount_usd,
       settlement_rail, metadata, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'PENDING')
  `, [
    id, type, reference, token_symbol,
    from_user_id, to_user_id,
    parseFloat(gross_amount || 0).toFixed(6),
    parseFloat(fee_amount   || 0).toFixed(6),
    parseFloat(net_amount   || 0).toFixed(6),
    settlement_rail,
    metadata ? JSON.stringify(metadata) : null,
  ]);
  return id;
}

module.exports = { createSettlementInstruction };
