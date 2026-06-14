const { getNumericSetting } = require('./platformSettings');

/**
 * Accrue partner commission for buyer and/or seller if either was referred by a partner.
 * Called OUTSIDE the trade transaction — failure never rolls back a settled trade.
 * Requires partner_clients rows to exist (populated when investors register via ref link).
 */
async function accruePartnerCommission(buyerId, sellerId, tradeValue, db) {
  const commissionRate = await getNumericSetting('partner_commission_rate', 0.001);
  for (const clientId of [buyerId, sellerId]) {
    if (!clientId) continue;
    const [rows] = await db.execute(
      `SELECT pc.partner_id FROM partner_clients pc
       WHERE pc.client_id = ? AND pc.status = 'ACTIVE' LIMIT 1`,
      [clientId]
    );
    if (rows.length === 0) continue;
    const partnerId = rows[0].partner_id;
    const amount    = parseFloat((tradeValue * commissionRate).toFixed(2));
    await db.execute(
      `INSERT INTO partner_commissions (partner_id, client_id, amount_usd, description, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [
        partnerId, clientId, amount,
        `Trade commission ${(commissionRate * 100).toFixed(3)}% on $${tradeValue.toFixed(2)} trade`
      ]
    );
  }
}

module.exports = { accruePartnerCommission };
