// api/src/services/conversionMinting.js
// Mints all tokens for an existing position conversion directly to the converting investor.
// Called from the admin-approve endpoint after AUDITOR_APPROVED status is confirmed.
// No offering is created — tokens go live immediately with a lockup on the investor's holdings.

const { v4: uuidv4 } = require('uuid');

/**
 * Mint all tokens for an EXISTING_POSITION_CONVERSION submission.
 *
 * @param {string} submissionId  — UUID of the data_submissions row
 * @param {object} db            — compatPool database handle
 * @param {string} approvedBy    — UUID of the admin who approved
 * @returns {{ tokenId, tokenSymbol, totalSupply, lockupEndDate }}
 */
async function mintConversionTokens(submissionId, db, approvedBy) {
  const [rows] = await db.execute(
    'SELECT * FROM data_submissions WHERE id = ? AND submission_type = ?',
    [submissionId, 'EXISTING_POSITION_CONVERSION']
  );
  if (rows.length === 0) throw new Error('Conversion submission not found: ' + submissionId);
  const sub = rows[0];

  if (!sub.converting_investor_id) {
    throw new Error('converting_investor_id is null on submission ' + submissionId);
  }

  let dataObj = {};
  try { dataObj = typeof sub.data_json === 'string' ? JSON.parse(sub.data_json) : (sub.data_json || {}); } catch {}

  const symbol      = (sub.token_symbol || dataObj.token_symbol || '').toUpperCase();
  const tokenName   = sub.entity_name   || dataObj.token_name   || symbol;
  const assetType   = (dataObj.asset_type || 'EQUITY').toUpperCase();
  const totalSupply = parseInt(dataObj.total_supply || sub.total_supply || 1000000, 10);
  const positionUsd = parseFloat(sub.existing_position_value_usd || dataObj.existing_position_value_usd || 0);
  const priceUsd    = totalSupply > 0 ? positionUsd / totalSupply : 1.00;
  const marketCap   = priceUsd * totalSupply;
  const lockupDays  = parseInt(dataObj.lockup_days || 90, 10);

  // Lockup end date = today + lockupDays
  const lockupEndDate = new Date();
  lockupEndDate.setDate(lockupEndDate.getDate() + lockupDays);
  const lockupEndStr = lockupEndDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Create token record in LIVE state (no PENDING intermediate for conversions)
    let tokenId;
    const [existingToken] = await conn.execute(
      'SELECT id FROM tokens WHERE token_symbol = ? OR symbol = ?',
      [symbol, symbol]
    );
    if (existingToken.length > 0) {
      tokenId = existingToken[0].id;
      await conn.execute(`
        UPDATE tokens
        SET market_state = 'LIMITED_TRADING', status = 'LIVE',
            current_price_usd = ?, oracle_price = ?, market_cap = ?,
            listing_type = 'CONVERSION', updated_at = NOW()
        WHERE id = ?
      `, [priceUsd.toFixed(6), priceUsd.toFixed(6), marketCap.toFixed(2), tokenId]);
    } else {
      tokenId = uuidv4();
      await conn.execute(`
        INSERT INTO tokens
          (id, symbol, name, company_name, token_symbol, token_name,
           asset_type, asset_class, issuer_id, total_supply,
           current_price_usd, price_usd, oracle_price, market_cap,
           trading_mode, market_state, status, listing_type,
           jurisdiction, submission_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIMITED_TRADING', 'LIMITED_TRADING', 'LIVE', 'CONVERSION', ?, ?)
      `, [
        tokenId, symbol, tokenName, tokenName, symbol, tokenName,
        assetType, assetType,
        sub.converting_investor_id,
        totalSupply,
        priceUsd.toFixed(6), priceUsd.toFixed(6), priceUsd.toFixed(6), marketCap.toFixed(2),
        sub.spv_jurisdiction || 'ZW',
        submissionId,
      ]);
    }

    // 2. Mint all tokens to the converting investor's holding
    const holdingId = uuidv4();
    await conn.execute(`
      INSERT INTO token_holdings
        (id, user_id, token_id, token_symbol, quantity, average_cost_usd,
         acquisition_type, locked_until, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'EXISTING_POSITION_CONVERSION', ?, NOW(), NOW())
      ON CONFLICT (user_id, token_id) DO UPDATE
        SET quantity           = token_holdings.quantity + EXCLUDED.quantity,
            locked_until       = EXCLUDED.locked_until,
            acquisition_type   = EXCLUDED.acquisition_type,
            updated_at         = NOW()
    `, [
      holdingId,
      sub.converting_investor_id,
      tokenId, symbol,
      totalSupply,
      priceUsd.toFixed(6),
      lockupEndStr,
    ]);

    // 3. Mark submission as LIVE and record lockup_end_date
    await conn.execute(`
      UPDATE data_submissions
      SET status = 'LIVE', application_status = 'LIVE',
          lockup_end_date = ?,
          admin_approved_by = ?, admin_approved_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [lockupEndStr, approvedBy, submissionId]);

    await conn.commit();

    return { tokenId, tokenSymbol: symbol, totalSupply, priceUsd: priceUsd.toFixed(6), lockupEndDate: lockupEndStr, lockupDays };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { mintConversionTokens };
